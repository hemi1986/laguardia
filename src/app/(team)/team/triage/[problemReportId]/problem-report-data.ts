import { problemReportForTriage } from "@/modules/repair";
import { teamMemberNames } from "@/modules/team";
import type { Clock } from "@/platform/clock";
import type { Database } from "@/platform/command";
import { withNames, type TriageListItem } from "../triage-list-data";

/**
 * A problem report's own page's data (ST-017): what the triage list shows of it, whether it is triaged yet and by whom,
 * and the version the person sees – the triage forms (ST-018 ff.) post it (HS-16).
 */
export type ProblemReportData =
  | { report: TriageListItem; triaged: boolean; triagedByName: string | undefined; version: number }
  | undefined;

export async function loadProblemReport(db: Database, clock: Clock, problemReportId: string): Promise<ProblemReportData> {
  const found = await problemReportForTriage(db, clock, problemReportId);
  if (!found) return undefined;
  const [[report], names] = await Promise.all([
    withNames(db, [found]),
    teamMemberNames(db, found.triagedBy ? [found.triagedBy] : []),
  ]);
  return {
    report,
    triaged: found.triagedBy !== undefined,
    triagedByName: found.triagedBy && names.get(found.triagedBy),
    version: found.version,
  };
}
