import { and, desc, eq, sql } from "drizzle-orm";
import type { Database, TeamMemberId } from "@/platform/command";
import type { DefectState, Resolution, WorkLogEntry } from "./defect";
import { resolutions, workLog } from "./defects";
import { defect, defectResolution, problemReport } from "./schema";

/**
 * One entry of a machine's repair history (CONTEXT.md: Repair history; RM-MachineRecord, ST-033): a defect with its
 * work log entries and resolutions, or a problem report resolved on the spot. Team members by ID – the page names them.
 */
export type RepairHistoryEntry =
  | {
      kind: "defect";
      id: string;
      title: string;
      state: DefectState;
      recordedAt: Date;
      /** The oldest entry first. */
      workLog: WorkLogEntry[];
      /** One per resolve, the oldest first – none while it was never resolved. */
      resolutions: Resolution[];
    }
  | {
      kind: "resolved-on-the-spot";
      /** The problem report's ID. */
      id: string;
      /** None only on a problem report dismissed as spam – which is never resolved on the spot. */
      description: string | undefined;
      reportedAt: Date;
      note: string;
      resolvedBy: TeamMemberId;
      resolvedAt: Date;
    };

/**
 * The repair history of a machine (RM-MachineRecord, ST-033): all its defects, open or not, with their work log
 * entries and resolutions, and its problem reports resolved on the spot – the newest first, by when the defect was
 * recorded or the problem reported. Dismissed and untriaged problem reports are not part of it; a linked one belongs to
 * its defect's page.
 */
export async function repairHistory(db: Database, machineId: string): Promise<RepairHistoryEntry[]> {
  const [defects, resolvedOnTheSpot] = await Promise.all([
    db
      .select({ id: defect.id, title: defect.title, state: defect.state, recordedAt: defect.recordedAt })
      .from(defect)
      .where(eq(defect.machineId, machineId)),
    db
      .select({
        id: problemReport.id,
        description: problemReport.description,
        reportedAt: problemReport.reportedAt,
        note: problemReport.triageNote,
        resolvedBy: problemReport.triagedBy,
        resolvedAt: problemReport.triagedAt,
      })
      .from(problemReport)
      .where(resolvedOnTheSpotOf(machineId)),
  ]);
  const ids = defects.map((row) => row.id);
  const [workLogs, resolutionsByDefect] = await Promise.all([workLog.load(db, ids), resolutions.load(db, ids)]);
  const entries: RepairHistoryEntry[] = [
    ...defects.map((row) => ({
      kind: "defect" as const,
      ...row,
      workLog: workLogs.get(row.id) ?? [],
      resolutions: resolutionsByDefect.get(row.id) ?? [],
    })),
    // Resolved on the spot: triaged, with its note – all three set together (ST-019).
    ...resolvedOnTheSpot.flatMap(({ note, resolvedBy, resolvedAt, description, ...row }) =>
      note !== null && resolvedBy && resolvedAt
        ? [
            {
              kind: "resolved-on-the-spot" as const,
              ...row,
              description: description ?? undefined,
              note,
              resolvedBy,
              resolvedAt,
            },
          ]
        : [],
    ),
  ];
  return entries.sort((a, b) => startOf(b).getTime() - startOf(a).getTime() || b.id.localeCompare(a.id));
}

/** When an entry of the repair history began – the defect recorded, the problem reported. */
function startOf(entry: RepairHistoryEntry): Date {
  return entry.kind === "defect" ? entry.recordedAt : entry.reportedAt;
}

/**
 * An entry of the repair history that has ended (ST-033): a resolved defect with the closing note of its latest
 * resolution, or a problem report resolved on the spot with its note – who ended it by ID, and when.
 */
export type EndedRepairHistoryEntry = {
  kind: "defect" | "resolved-on-the-spot";
  /** The defect's or the problem report's ID. */
  id: string;
  /** The defect's title, or the problem report's description. */
  title: string | undefined;
  /** The closing note, or the note of the resolution on the spot. */
  note: string;
  resolvedBy: TeamMemberId;
  resolvedAt: Date;
};

/**
 * The most recently ended entries of a machine's repair history (RM-MachineRecord, section 7 – ST-033): at most
 * `limit`, the most recently ended first, and how many entries its whole repair history has, open defects included.
 * Only what the machine record shows is read – never the whole history. A reopened defect (ST-030) and one closed on
 * retirement (ST-039) change what "ended" means here, not in the page.
 */
export async function recentRepairHistory(
  db: Database,
  machineId: string,
  limit: number,
): Promise<{ entries: EndedRepairHistoryEntry[]; total: number }> {
  const latestResolution = sql`${defectResolution.position} = (SELECT max(r.position) FROM ${defectResolution} r WHERE r.defect_id = ${defect.id})`;
  const [resolvedDefects, resolvedOnTheSpot, [defects], [problemReports]] = await Promise.all([
    db
      .select({
        id: defect.id,
        title: defect.title,
        note: defectResolution.closingNote,
        resolvedBy: defectResolution.resolvedBy,
        resolvedAt: defectResolution.resolvedAt,
      })
      .from(defect)
      .innerJoin(defectResolution, eq(defectResolution.defectId, defect.id))
      .where(and(eq(defect.machineId, machineId), eq(defect.state, "resolved"), latestResolution))
      .orderBy(desc(defectResolution.resolvedAt))
      .limit(limit),
    db
      .select({
        id: problemReport.id,
        title: problemReport.description,
        note: problemReport.triageNote,
        resolvedBy: problemReport.triagedBy,
        resolvedAt: problemReport.triagedAt,
      })
      .from(problemReport)
      .where(resolvedOnTheSpotOf(machineId))
      .orderBy(desc(problemReport.triagedAt))
      .limit(limit),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(defect)
      .where(eq(defect.machineId, machineId)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(problemReport)
      .where(resolvedOnTheSpotOf(machineId)),
  ]);
  const entries: EndedRepairHistoryEntry[] = [
    ...resolvedDefects.map((row) => ({ kind: "defect" as const, ...row })),
    // Resolved on the spot: triaged, with its note – all three set together (ST-019).
    ...resolvedOnTheSpot.flatMap(({ title, note, resolvedBy, resolvedAt, id }) =>
      note !== null && resolvedBy && resolvedAt
        ? [{ kind: "resolved-on-the-spot" as const, id, title: title ?? undefined, note, resolvedBy, resolvedAt }]
        : [],
    ),
  ];
  return {
    entries: entries.sort((a, b) => b.resolvedAt.getTime() - a.resolvedAt.getTime()).slice(0, limit),
    total: defects.count + problemReports.count,
  };
}

/** The machine's problem reports resolved on the spot – the only triage outcome of a problem report in its history. */
function resolvedOnTheSpotOf(machineId: string) {
  return and(eq(problemReport.machineId, machineId), eq(problemReport.triageOutcome, "resolved-on-the-spot"));
}
