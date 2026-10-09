import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { aggregateStore, type Database } from "@/platform/command";
import { priorities, type Defect, type DefectState, type Priority } from "./defect";
import type { LinkingFacts } from "./link-problem-report-to-defect";
import { problemReportsOfDefect, type DefectProblemReport } from "./problem-reports";
import { defect, problemReport } from "./schema";

/** How AGG-Defect is stored (ST-018): one row per defect, versioned (HS-16). */
export const defects = aggregateStore({
  type: "AGG-Defect",
  table: defect,
  toState: (row): Defect => ({
    id: row.id,
    machineId: row.machineId,
    problemReportId: row.problemReportId,
    title: row.title,
    priority: row.priority,
    suitableForHelpers: row.suitableForHelpers,
    recordedBy: row.recordedBy,
    recordedAt: row.recordedAt,
    state: row.state,
  }),
  toRow: (state: Defect) => ({ ...state }),
});

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
  /** How many problem reports were linked to it (ST-022) – not counting the one it was recorded from. */
  linkedProblemReports: number;
};

/** What RM-OpenDefects is narrowed to (ST-021) – all optional, they combine. */
export type OpenDefectsQuery = {
  /** Only the defects of one machine. */
  machineId?: string;
  priority?: Priority;
  /** Only the defects a helper may take on. */
  suitableForHelpers?: boolean;
};

/** In the order of `priorities` – high first, then normal, then low (ST-021). */
const priorityRank = sql`CASE ${defect.priority} ${sql.join(
  priorities.map((priority, rank) => sql`WHEN ${priority} THEN ${sql.raw(String(rank))}`),
  sql` `,
)} END`;

/**
 * RM-OpenDefects (ST-021): every open defect, by priority – high first –, within a priority the oldest first, with the
 * number of problem reports linked to it (ST-022). Claim, hold and work log follow with ST-024, ST-025 and ST-029.
 */
export async function openDefects(
  db: Database,
  { machineId, priority, suitableForHelpers }: OpenDefectsQuery = {},
): Promise<OpenDefect[]> {
  return db
    .select({
      id: defect.id,
      machineId: defect.machineId,
      title: defect.title,
      priority: defect.priority,
      suitableForHelpers: defect.suitableForHelpers,
      openSince: defect.recordedAt,
      linkedProblemReports: sql<number>`count(${problemReport.id})::int`,
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
      ),
    )
    .groupBy(defect.id)
    .orderBy(priorityRank, asc(defect.recordedAt), asc(defect.id));
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
  problemReports: DefectProblemReport[];
};

/** A defect with its problem reports; undefined for an unknown ID, or an address that is no ID at all. */
export async function defectDetails(db: Database, defectId: string): Promise<DefectDetails | undefined> {
  if (!isId(defectId)) return undefined;
  const [row] = await db.select().from(defect).where(eq(defect.id, defectId));
  if (!row) return undefined;
  return {
    id: row.id,
    machineId: row.machineId,
    title: row.title,
    priority: row.priority,
    suitableForHelpers: row.suitableForHelpers,
    recordedAt: row.recordedAt,
    state: row.state,
    problemReports: await problemReportsOfDefect(db, row),
  };
}

/**
 * The facts of CMD-LinkProblemReportToDefect (ST-022): the chosen defect's machine and state, read in the command's
 * transaction. The row is locked for share until the command commits, so a defect cannot be resolved between the check
 * and the link – a concurrent resolution waits and then resolves it with the linked problem report.
 */
export async function linkingFacts(tx: Database, input: { defectId: string | undefined }): Promise<LinkingFacts> {
  if (!input.defectId || !isId(input.defectId)) return { defect: undefined };
  const [row] = await tx
    .select({ id: defect.id, machineId: defect.machineId, state: defect.state })
    .from(defect)
    .where(eq(defect.id, input.defectId))
    .for("share");
  return { defect: row };
}

function isId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
