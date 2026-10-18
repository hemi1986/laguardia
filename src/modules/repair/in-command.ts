import { entriesOf, type JournalEntry } from "@/platform/command";
import { repairEvents } from "./events";

/** A triage outcome as a page confirms it (G3). */
export type TriagedInCommand =
  | { outcome: "defect-recorded"; defectId: string }
  | { outcome: "linked"; defectId: string }
  | { outcome: "resolved-on-the-spot" }
  | { outcome: "dismissed" };

/**
 * The triage outcome one command gave this problem report – asked of the events `lastCommandBy` returns, for a page's
 * confirmation (G3, architecture review 2026-10-18). The event types and their data stay this module's own.
 */
export function triageOutcomeIn(
  command: readonly JournalEntry[],
  problemReportId: string,
): TriagedInCommand | undefined {
  for (const entry of entriesOf(repairEvents, command)) {
    if (entry.aggregate.id !== problemReportId) continue;
    switch (entry.type) {
      case "EVT-DefectRecorded":
        return entry.data.defectId ? { outcome: "defect-recorded", defectId: String(entry.data.defectId) } : undefined;
      case "EVT-ProblemReportLinkedToDefect":
        return entry.data.defectId ? { outcome: "linked", defectId: String(entry.data.defectId) } : undefined;
      case "EVT-ProblemResolvedOnTheSpot":
        return { outcome: "resolved-on-the-spot" };
      case "EVT-ProblemReportDismissed":
        return { outcome: "dismissed" };
    }
  }
  return undefined;
}

/** Whether the command reported a problem on this machine (ST-015). */
export function problemReportedIn(command: readonly JournalEntry[], machineId: string): boolean {
  return entriesOf(repairEvents, command).some(
    (entry) => entry.type === "EVT-ProblemReported" && entry.machineId === machineId,
  );
}
