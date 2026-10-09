import type { Clock } from "@/platform/clock";
import type { Database } from "@/platform/command";
import { loadProblemReport } from "./problem-report-data";

/**
 * A rejected triage form (ST-018, ST-019) with what it needs to say it: when the reason is that someone triaged the
 * problem report first – also the loser of two team members at the same moment (ST-018) –, who that was.
 */
export async function withWhoTriagedFirst<const State extends { error: string; triagedBy?: string } | null>(
  db: Database,
  clock: Clock,
  problemReportId: string,
  state: State,
): Promise<State> {
  if (state?.error !== "already-triaged") return state;
  const report = await loadProblemReport(db, clock, problemReportId);
  return { ...state, triagedBy: report?.triagedByName };
}
