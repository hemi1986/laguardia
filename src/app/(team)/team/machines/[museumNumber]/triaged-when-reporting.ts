import type { MachineStatus } from "@/modules/collection";
import { defectTitle, problemReportForTriage } from "@/modules/repair";
import type { Clock } from "@/platform/clock";
import type { Database } from "@/platform/command";

/**
 * What the machine record confirms after a problem was reported and triaged in the same step (ST-023, ST-052, G3): the
 * defect recorded (and the machine's status, when the form changed it), the defect linked to, or that it was resolved
 * on the spot.
 */
export type TriagedWhenReporting =
  | { outcome: "defect-recorded"; title: string; newStatus: MachineStatus | undefined }
  | { outcome: "linked"; title: string }
  | { outcome: "resolved-on-the-spot" };

type Query = { [name: string]: string | string[] | undefined };

const one = (value: string | string[] | undefined) => (typeof value === "string" ? value : undefined);

/**
 * The confirmation from the IDs in the address – only what is stored for this machine: the address cannot make the page
 * say anything that is not so.
 */
export async function loadTriagedWhenReporting(
  db: Database,
  clock: Clock,
  machine: { id: string; machineStatus: MachineStatus },
  query: Query,
): Promise<TriagedWhenReporting | undefined> {
  const defectId = one(query.defectRecorded);
  if (defectId) {
    const recorded = await defectTitle(db, defectId);
    if (recorded?.machineId !== machine.id) return undefined;
    const newStatus = query.statusChanged !== undefined ? machine.machineStatus : undefined;
    return { outcome: "defect-recorded", title: recorded.title, newStatus };
  }
  const problemReportId = one(query.linked) ?? one(query.resolvedOnTheSpot);
  if (!problemReportId) return undefined;
  const report = await problemReportForTriage(db, clock, problemReportId);
  if (report?.machineId !== machine.id) return undefined;
  if (query.resolvedOnTheSpot !== undefined) {
    return report.triageOutcome === "resolved-on-the-spot" ? { outcome: "resolved-on-the-spot" } : undefined;
  }
  if (report.triageOutcome !== "linked" || !report.triageDefectId) return undefined;
  const linkedTo = await defectTitle(db, report.triageDefectId);
  return linkedTo && { outcome: "linked", title: linkedTo.title };
}
