import { problemReportForTriage } from "@/modules/repair";
import type { Clock } from "@/platform/clock";
import type { Database } from "@/platform/command";
import { withNames, type TriageListItem } from "../triage-list-data";

/** A problem report's own page's data (ST-017): what the triage list shows of it, and whether it is triaged yet. */
export type ProblemReportData = { report: TriageListItem; triaged: boolean } | undefined;

export async function loadProblemReport(db: Database, clock: Clock, problemReportId: string): Promise<ProblemReportData> {
  const found = await problemReportForTriage(db, clock, problemReportId);
  if (!found) return undefined;
  const [report] = await withNames(db, [found]);
  return { report, triaged: found.triaged };
}
