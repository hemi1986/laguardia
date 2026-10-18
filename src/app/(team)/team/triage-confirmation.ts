import { collectionChangesIn, machineLabels, type MachineStatus } from "@/modules/collection";
import { defectTitle, problemReportForTriage, triageOutcomeIn } from "@/modules/repair";
import type { Clock } from "@/platform/clock";
import { lastCommandBy, type Database, type TeamMemberId } from "@/platform/command";
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

/** A page's query as Next.js hands it over – what the address asks a page to confirm. */
export type AddressQuery = { [name: string]: string | string[] | undefined };

/** One value of the query – none when the address gives it twice. */
export const oneOf = (value: string | string[] | undefined) => (typeof value === "string" ? value : undefined);

/** Which outcome each address parameter asks for; each names the problem report. */
const asked = [
  ["defectRecorded", "defect-recorded"],
  ["linked", "linked"],
  ["resolvedOnTheSpot", "resolved-on-the-spot"],
  ["dismissed", "dismissed"],
] as const;

/**
 * The confirmation the address asks for (`defectRecorded=`, `linked=`, `resolvedOnTheSpot=`, `dismissed=<problem
 * report>`) – only when the latest command on that problem report gave it that outcome and the team member looking at
 * the page ran it (architecture review 2026-10-18). Everything it names is read now; `onMachine` keeps a machine record
 * to its own machine.
 */
export async function loadTriageConfirmation(
  db: Database,
  clock: Clock,
  viewer: TeamMemberId,
  query: AddressQuery,
  onMachine?: string,
): Promise<TriageConfirmation | undefined> {
  const [parameter, outcome] = asked.find(([name]) => oneOf(query[name])) ?? [];
  const problemReportId = parameter && oneOf(query[parameter]);
  if (!outcome || !problemReportId) return undefined;
  const command = await lastCommandBy(db, { aggregateId: problemReportId }, viewer);
  const triaged = command && triageOutcomeIn(command, problemReportId);
  if (triaged?.outcome !== outcome) return undefined;
  const report = await problemReportForTriage(db, clock, problemReportId);
  if (!report || (onMachine && report.machineId !== onMachine)) return undefined;
  const museumNumber = (await machineLabels(db, [report.machineId])).get(report.machineId)?.museumNumber ?? "";
  if (triaged.outcome === "resolved-on-the-spot" || triaged.outcome === "dismissed") {
    return { outcome: triaged.outcome, museumNumber };
  }
  const defect = await defectTitle(db, triaged.defectId);
  if (!defect) return undefined;
  if (triaged.outcome === "linked") return { outcome: "linked", museumNumber, title: defect.title };
  return {
    outcome: "defect-recorded",
    museumNumber,
    title: defect.title,
    newStatus: collectionChangesIn(command!, report.machineId).statusChangedTo,
  };
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
