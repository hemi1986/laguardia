import { defectsToLinkTo, problemReportForTriage, type DefectsToLinkTo } from "@/modules/repair";
import { named } from "../../named";
import type { Clock } from "@/platform/clock";
import type { Database } from "@/platform/command";
import { blobStorage } from "@/platform/storage";
import type { PhotoSource } from "../../team-photos";
import { withNames, type TriageListItem } from "../triage-list-data";

/**
 * A problem report's own page's data (ST-017): what the triage list shows of it, whether it is triaged yet and by whom,
 * and the version the person sees – the triage forms (ST-018 ff.) post it (HS-16) –, and the defects of its machine it
 * can be linked to: open (ST-022) and recently resolved ones (ST-053).
 */
export type ProblemReportData =
  | {
      report: TriageListItem;
      triaged: boolean;
      triagedByName: string | undefined;
      version: number;
      /** Dismissed as spam (ST-020): its description and photo are gone – the page says so. */
      dismissedAsSpam: boolean;
      /** What „Mit Defekt verknüpfen“ offers: the open defects, then the recently resolved ones (ST-022, ST-053). */
      defectsToLinkTo: DefectsToLinkTo;
    }
  | undefined;

export async function loadProblemReport(
  db: Database,
  clock: Clock,
  problemReportId: string,
  { storage = blobStorage() }: PhotoSource = {},
): Promise<ProblemReportData> {
  const found = await problemReportForTriage(db, clock, problemReportId);
  if (!found) return undefined;
  const [[report], shown, defects] = await Promise.all([
    withNames(db, [found], { clock, storage }),
    named(db, { teamMembers: [found.triagedBy] }),
    defectsToLinkTo(db, clock, found.machineId),
  ]);
  return {
    report,
    triaged: found.triagedBy !== undefined,
    triagedByName: found.triagedBy && shown.name(found.triagedBy),
    version: found.version,
    dismissedAsSpam: found.dismissalReason === "spam",
    defectsToLinkTo: defects,
  };
}
