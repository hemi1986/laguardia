import { and, desc, eq } from "drizzle-orm";
import type { Database, TeamMemberId } from "@/platform/command";
import type { DefectState, Resolution, WorkLogEntry } from "./defect";
import { resolutions, workLog } from "./defects";
import { defect, problemReport } from "./schema";

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
      .where(and(eq(problemReport.machineId, machineId), eq(problemReport.triageOutcome, "resolved-on-the-spot")))
      .orderBy(desc(problemReport.reportedAt)),
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
        ? [{ kind: "resolved-on-the-spot" as const, ...row, description: description ?? undefined, note, resolvedBy, resolvedAt }]
        : [],
    ),
  ];
  return entries.sort((a, b) => startOf(b).getTime() - startOf(a).getTime() || b.id.localeCompare(a.id));
}

/** When an entry of the repair history began – the defect recorded, the problem reported. */
export function startOf(entry: RepairHistoryEntry): Date {
  return entry.kind === "defect" ? entry.recordedAt : entry.reportedAt;
}
