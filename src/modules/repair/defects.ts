import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { aggregateStore, history, type Database } from "@/platform/command";
import {
  priorities,
  type Claim,
  type Defect,
  type DefectState,
  type Priority,
  type Resolution,
  type WorkLogEntry,
} from "./defect";
import {
  defectActionRefusals,
  type DefectAction,
  type DefectActionRefusals,
  type DefectTeamMember,
} from "./defect-actions";
import type { LinkingFacts } from "./link-problem-report-to-defect";
import { problemReportsOfDefect, type DefectProblemReport } from "./problem-reports";
import { defect, defectResolution, defectWorkLogEntry, problemReport } from "./schema";

/** The work log of a defect (ST-024) – append-only (Q13). */
export const workLog = history({
  table: defectWorkLogEntry,
  owner: "defectId",
  toEntry: (row): WorkLogEntry => ({
    id: row.id,
    whatWasDone: row.whatWasDone,
    partsUsed: row.partsUsed ?? undefined,
    loggedBy: row.loggedBy,
    loggedAt: row.loggedAt,
  }),
  toRow: (entry) => ({ ...entry, partsUsed: entry.partsUsed ?? null }),
});

/** The resolutions of a defect (ST-028) – append-only (Q13). */
export const resolutions = history({
  table: defectResolution,
  owner: "defectId",
  toEntry: (row): Resolution => ({
    id: row.id,
    closingNote: row.closingNote,
    resolvedBy: row.resolvedBy,
    resolvedAt: row.resolvedAt,
  }),
  toRow: (resolution) => resolution,
});

/** How AGG-Defect is stored (ST-018): one row per defect, versioned (HS-16), with its work log and its resolutions. */
export const defects = aggregateStore({
  type: "AGG-Defect",
  table: defect,
  histories: { workLog, resolutions },
  toState: (row, histories): Defect => ({
    id: row.id,
    machineId: row.machineId,
    problemReportId: row.problemReportId,
    title: row.title,
    priority: row.priority,
    suitableForHelpers: row.suitableForHelpers,
    recordedBy: row.recordedBy,
    recordedAt: row.recordedAt,
    state: row.state,
    ...claimOf(row),
    workLog: histories.workLog,
    resolutions: histories.resolutions,
  }),
  // null, not undefined: an update leaves out undefined columns, and a claim must be removable (ST-026).
  toRow: (state: Defect) => ({
    id: state.id,
    machineId: state.machineId,
    problemReportId: state.problemReportId,
    title: state.title,
    priority: state.priority,
    suitableForHelpers: state.suitableForHelpers,
    recordedBy: state.recordedBy,
    recordedAt: state.recordedAt,
    state: state.state,
    claimedBy: state.claim?.claimedBy ?? null,
    claimedAt: state.claim?.claimedAt ?? null,
    assignedBy: state.claim?.assignedBy ?? null,
  }),
});

/** The Claim value object of a stored defect – none while it is unclaimed. */
function claimOf(row: Pick<typeof defect.$inferSelect, "claimedBy" | "claimedAt" | "assignedBy">): { claim?: Claim } {
  if (!row.claimedBy || !row.claimedAt) return {};
  return {
    claim: {
      claimedBy: row.claimedBy,
      claimedAt: row.claimedAt,
      ...(row.assignedBy ? { assignedBy: row.assignedBy } : {}),
    },
  };
}

/**
 * The titles of a machine's open defects, the oldest first – what the visitor machine page shows (RM-VisitorMachinePage,
 * ST-018): written by a technician to be understood by visitors, shown untranslated.
 */
export async function openDefectTitles(db: Database, machineId: string): Promise<string[]> {
  const rows = await db
    .select({ title: defect.title })
    .from(defect)
    .where(and(eq(defect.machineId, machineId), eq(defect.state, "open")))
    .orderBy(asc(defect.recordedAt), asc(defect.id));
  return rows.map((row) => row.title);
}

/** A defect's title and machine – for the confirmation after recording it (ST-018, G3). */
export async function defectTitle(
  db: Database,
  defectId: string,
): Promise<{ title: string; machineId: string } | undefined> {
  if (!isId(defectId)) return undefined;
  const [row] = await db
    .select({ title: defect.title, machineId: defect.machineId })
    .from(defect)
    .where(eq(defect.id, defectId));
  return row;
}

/** One open defect as the open defects list shows it (RM-OpenDefects, ST-021) – its machine by ID; the page names it. */
export type OpenDefect = {
  id: string;
  machineId: string;
  title: string;
  priority: Priority;
  suitableForHelpers: boolean;
  /** When it was recorded – it has been open since then (data model: Recorded at). */
  openSince: Date;
  /** Its claimant, if any (ST-025) – by ID; the page names them. */
  claimedBy: string | undefined;
  /** How many problem reports were linked to it (ST-022) – not counting the one it was recorded from. */
  linkedProblemReports: number;
  /** Who last logged work on it, and when (ST-024) – by ID; none while nobody has. */
  lastWorkLogEntry: { loggedBy: string; loggedAt: Date } | undefined;
};

/** What RM-OpenDefects is narrowed to (ST-021) – all optional, they combine. */
export type OpenDefectsQuery = {
  /** Only the defects of one machine. */
  machineId?: string;
  priority?: Priority;
  /** Only the defects a helper may take on. */
  suitableForHelpers?: boolean;
  /** Only the defects this team member has claimed (ST-025, "claimed by me"). */
  claimedBy?: string;
};

/** In the order of `priorities` – high first, then normal, then low (ST-021). */
const priorityRank = sql`CASE ${defect.priority} ${sql.join(
  priorities.map((priority, rank) => sql`WHEN ${priority} THEN ${sql.raw(String(rank))}`),
  sql` `,
)} END`;

/**
 * RM-OpenDefects (ST-021): every open defect, by priority – high first –, within a priority the oldest first, with the
 * number of problem reports linked to it (ST-022), its claimant (ST-025) and its last work log entry (ST-024). Its hold
 * follows with ST-029.
 */
export async function openDefects(
  db: Database,
  { machineId, priority, suitableForHelpers, claimedBy }: OpenDefectsQuery = {},
): Promise<OpenDefect[]> {
  const rows = await db
    .select({
      id: defect.id,
      machineId: defect.machineId,
      title: defect.title,
      priority: defect.priority,
      suitableForHelpers: defect.suitableForHelpers,
      openSince: defect.recordedAt,
      claimedBy: defect.claimedBy,
      linkedProblemReports: sql<number>`count(${problemReport.id})::int`,
      lastLoggedBy: sql<string | null>`(${lastWorkLogEntry(defectWorkLogEntry.loggedBy)})`,
      lastLoggedAt: sql`(${lastWorkLogEntry(defectWorkLogEntry.loggedAt)})`.mapWith(defectWorkLogEntry.loggedAt),
    })
    .from(defect)
    .leftJoin(
      problemReport,
      and(eq(problemReport.triageDefectId, defect.id), eq(problemReport.triageOutcome, "linked")),
    )
    .where(
      and(
        eq(defect.state, "open"),
        machineId ? eq(defect.machineId, machineId) : undefined,
        priority ? eq(defect.priority, priority) : undefined,
        suitableForHelpers ? eq(defect.suitableForHelpers, true) : undefined,
        claimedBy ? eq(defect.claimedBy, claimedBy) : undefined,
      ),
    )
    .groupBy(defect.id)
    .orderBy(priorityRank, asc(defect.recordedAt), asc(defect.id));
  return rows.map(({ lastLoggedBy, lastLoggedAt, ...row }) => ({
    ...row,
    claimedBy: row.claimedBy ?? undefined,
    lastWorkLogEntry: lastLoggedBy && lastLoggedAt ? { loggedBy: lastLoggedBy, loggedAt: lastLoggedAt } : undefined,
  }));
}

/** One column of the work log entry stored last for the defect of the surrounding query. */
function lastWorkLogEntry(column: typeof defectWorkLogEntry.loggedBy | typeof defectWorkLogEntry.loggedAt) {
  return sql`SELECT ${column} FROM ${defectWorkLogEntry} WHERE ${defectWorkLogEntry.defectId} = ${defect.id} ORDER BY ${defectWorkLogEntry.position} DESC LIMIT 1`;
}

/**
 * How many open defects each of the given machines has (ST-021) – what the machine overview shows per machine. A
 * machine without open defects is not in the map.
 */
export async function openDefectCounts(db: Database, machineIds: readonly string[]): Promise<Map<string, number>> {
  if (machineIds.length === 0) return new Map();
  const rows = await db
    .select({ machineId: defect.machineId, count: sql<number>`count(*)::int` })
    .from(defect)
    .where(and(eq(defect.state, "open"), inArray(defect.machineId, [...machineIds])))
    .groupBy(defect.machineId);
  return new Map(rows.map((row) => [row.machineId, row.count]));
}

/**
 * A defect for its own page (ST-021), in whatever state it is – with its problem reports, the originating one first.
 */
export type DefectDetails = {
  id: string;
  machineId: string;
  title: string;
  priority: Priority;
  suitableForHelpers: boolean;
  recordedAt: Date;
  state: DefectState;
  /** The version the team member sees – a command on the defect names it (HS-16). */
  version: number;
  /** Its claim, if any (ST-025). */
  claim: Claim | undefined;
  /**
   * What the asking team member can do to it – per action the command's reason for refusing, or none (G11). Undefined
   * when nobody in particular asked.
   */
  actions: DefectActionRefusals | undefined;
  /** Its work log (ST-024), the oldest entry first – the page decides the order it shows. */
  workLog: WorkLogEntry[];
  /** How it ended – the resolution that made it resolved (ST-028); none while it is open. */
  resolution: Omit<Resolution, "id"> | undefined;
  problemReports: DefectProblemReport[];
};

/**
 * A defect with its problem reports – and, for the team member who asks, what they can do to it; undefined for an
 * unknown ID, or an address that is no ID at all.
 */
export async function defectDetails(
  db: Database,
  defectId: string,
  teamMember?: DefectTeamMember,
): Promise<DefectDetails | undefined> {
  const loaded = await loadDefect(db, defectId);
  if (!loaded) return undefined;
  const { state: stored, version } = loaded;
  const resolution = stored.state === "resolved" ? stored.resolutions.at(-1) : undefined;
  return {
    id: stored.id,
    machineId: stored.machineId,
    title: stored.title,
    priority: stored.priority,
    suitableForHelpers: stored.suitableForHelpers,
    recordedAt: stored.recordedAt,
    state: stored.state,
    version,
    claim: stored.claim,
    actions: teamMember && defectActionRefusals(stored, teamMember),
    workLog: stored.workLog,
    resolution: resolution && {
      closingNote: resolution.closingNote,
      resolvedBy: resolution.resolvedBy,
      resolvedAt: resolution.resolvedAt,
    },
    problemReports: await problemReportsOfDefect(db, stored),
  };
}

/**
 * A defect as a form on it needs it (architecture review 2026-10-17): the defect as its store loads it, the version
 * the form posts (HS-16) and – for the team member who asks – why the form's command would refuse them (G11), none
 * if it would not. One read for every form page on a defect, so a new field of the defect reaches all of them.
 * Undefined for an unknown ID, or an address that is no ID at all.
 */
export type DefectForAction<Action extends DefectAction> = Defect & {
  version: number;
  whyNot: DefectActionRefusals[Action];
};

export async function defectForAction<Action extends DefectAction>(
  db: Database,
  defectId: string,
  teamMember: DefectTeamMember,
  action: Action,
): Promise<DefectForAction<Action> | undefined> {
  const loaded = await loadDefect(db, defectId);
  if (!loaded) return undefined;
  return { ...loaded.state, version: loaded.version, whyNot: defectActionRefusals(loaded.state, teamMember)[action] };
}

/** The defect through its store – the one mapping from its rows to its state (ST-018). */
async function loadDefect(db: Database, defectId: string) {
  return isId(defectId) ? defects.load(db, defectId) : undefined;
}

/**
 * The facts of CMD-LinkProblemReportToDefect (ST-022): the chosen defect's machine and state, read in the command's
 * transaction. The row stays locked until the command commits, so a concurrent change of the defect (its resolution,
 * ST-028) waits instead of slipping between the check and the link. `FOR UPDATE`, not `FOR SHARE`: from ST-053 on the
 * same transaction reopens a resolved defect, and two links holding a share lock would deadlock on that write.
 */
export async function linkingFacts(tx: Database, input: { defectId: string | undefined }): Promise<LinkingFacts> {
  if (!input.defectId || !isId(input.defectId)) return { defect: undefined };
  const [row] = await tx
    .select({ id: defect.id, machineId: defect.machineId, state: defect.state })
    .from(defect)
    .where(eq(defect.id, input.defectId))
    .for("update");
  return { defect: row };
}

function isId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
