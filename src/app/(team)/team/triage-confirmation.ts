import { machineLabels, type MachineStatus } from "@/modules/collection";
import { defectTitle, problemReportForTriage } from "@/modules/repair";
import type { Clock } from "@/platform/clock";
import { lastCommandBy, type Database } from "@/platform/command";
import { teamMessages } from "@/platform/messages";

/**
 * What a page confirms after a triage outcome (G3) – the triage list after triaging (ST-018 – ST-022) and the machine
 * record after reporting and triaging in one step (ST-023, ST-052): the defect recorded (with the machine's new status
 * when the same step changed it), the defect linked to, that the problem was resolved on the spot, or dismissed.
 */
export type TriageConfirmation =
  | { outcome: "defect-recorded"; museumNumber: string; title: string; newStatus: MachineStatus | undefined }
  | { outcome: "linked"; museumNumber: string; title: string }
  | { outcome: "resolved-on-the-spot"; museumNumber: string }
  | { outcome: "dismissed"; museumNumber: string };

type Query = { [name: string]: string | string[] | undefined };

const one = (value: string | string[] | undefined) => (typeof value === "string" ? value : undefined);

/**
 * The confirmation the address asks for (`defectRecorded=<defect>`, `linked=`, `resolvedOnTheSpot=`, `dismissed=<problem
 * report>`) – only when the latest command on it was that outcome and the team member looking at the page ran it
 * (architecture review 2026-10-18). Everything it names is read now; `onMachine` keeps a machine record to its own.
 */
export async function loadTriageConfirmation(
  db: Database,
  clock: Clock,
  viewer: string,
  query: Query,
  onMachine?: string,
): Promise<TriageConfirmation | undefined> {
  const defectId = one(query.defectRecorded);
  if (defectId) {
    const recorded = await defectTitle(db, defectId);
    if (!recorded || (onMachine && recorded.machineId !== onMachine)) return undefined;
    const command = await lastCommandBy(db, { machineId: recorded.machineId }, viewer);
    const recording = command?.find((entry) => entry.type === "EVT-DefectRecorded" && entry.data.defectId === defectId);
    if (!recording) return undefined;
    const statusChange = command!.find(
      (entry) => entry.type === "EVT-MachineStatusChanged" && entry.aggregate.id === recorded.machineId,
    );
    return {
      outcome: "defect-recorded",
      museumNumber: await museumNumberOf(db, recorded.machineId),
      title: recorded.title,
      newStatus: statusChange?.data.newStatus as MachineStatus | undefined,
    };
  }
  for (const [parameter, outcome, type] of [
    ["linked", "linked", "EVT-ProblemReportLinkedToDefect"],
    ["resolvedOnTheSpot", "resolved-on-the-spot", "EVT-ProblemResolvedOnTheSpot"],
    ["dismissed", "dismissed", "EVT-ProblemReportDismissed"],
  ] as const) {
    const problemReportId = one(query[parameter]);
    if (!problemReportId) continue;
    const command = await lastCommandBy(db, { aggregateId: problemReportId }, viewer);
    if (!command?.some((entry) => entry.type === type)) return undefined;
    const report = await problemReportForTriage(db, clock, problemReportId);
    if (!report || report.triageOutcome !== outcome || (onMachine && report.machineId !== onMachine)) return undefined;
    const museumNumber = await museumNumberOf(db, report.machineId);
    if (outcome !== "linked") return { outcome, museumNumber };
    const linkedTo = report.triageDefectId ? await defectTitle(db, report.triageDefectId) : undefined;
    return linkedTo && { outcome, museumNumber, title: linkedTo.title };
  }
  return undefined;
}

async function museumNumberOf(db: Database, machineId: string): Promise<string> {
  return (await machineLabels(db, [machineId])).get(machineId)?.museumNumber ?? "";
}

const { recordDefect, resolveOnTheSpot, dismiss, link, machines } = teamMessages;

/** The confirmation in words – the same on every page that shows it. */
export function triageConfirmationText(confirmation: TriageConfirmation): string {
  switch (confirmation.outcome) {
    case "defect-recorded":
      return (
        recordDefect.recorded(confirmation.title, confirmation.museumNumber) +
        (confirmation.newStatus
          ? recordDefect.statusNow(confirmation.museumNumber, machines.statuses[confirmation.newStatus])
          : "")
      );
    case "linked":
      return link.linked(confirmation.museumNumber, confirmation.title);
    case "resolved-on-the-spot":
      return resolveOnTheSpot.resolved(confirmation.museumNumber);
    case "dismissed":
      return dismiss.dismissed(confirmation.museumNumber);
  }
}
