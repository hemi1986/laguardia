import type { Clock } from "@/platform/clock";
import type { Database } from "@/platform/command";
import { loadProblemReport } from "../problem-report-data";
import type { RecordDefectState } from "./actions";

/**
 * A rejected „Defekt erfassen“ with what the form needs to say it: when the reason is that someone triaged the problem
 * report first – also the loser of two technicians at the same moment (ST-018) –, who that was.
 */
export async function withWhoTriagedFirst(
  db: Database,
  clock: Clock,
  problemReportId: string,
  state: RecordDefectState,
): Promise<RecordDefectState> {
  if (state?.error !== "already-triaged") return state;
  const report = await loadProblemReport(db, clock, problemReportId);
  return { ...state, triagedBy: report?.triagedByName };
}
