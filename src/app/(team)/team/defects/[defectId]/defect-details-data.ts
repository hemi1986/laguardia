import { machineLabels } from "@/modules/collection";
import { defectDetails, type Priority } from "@/modules/repair";
import { teamMemberNames } from "@/modules/team";
import type { Clock } from "@/platform/clock";
import type { Database } from "@/platform/command";
import { elapsedHours } from "@/platform/time";
import type { ShownReporter } from "../../triage/triage-list-data";

/** A problem report on the defect's page, its reporter named. */
export type ShownDefectProblemReport = {
  id: string;
  description: string;
  reporter: ShownReporter;
  reportedAt: Date;
  originating: boolean;
};

/** A defect's own page (ST-021): its machine, title, priority, mark, how long it is open, and its problem reports. */
export type DefectDetailsData = {
  title: string;
  museumNumber: string;
  machineModelTitle: string;
  priority: Priority;
  suitableForHelpers: boolean;
  openSince: Date;
  openHours: number;
  problemReports: ShownDefectProblemReport[];
};

/**
 * The defect page's data: Repair's defect with its problem reports, Collection's museum number and title, Team's names
 * – the page composes the modules' public queries (ST-009). Undefined when there is no such defect.
 */
export async function loadDefectDetails(
  db: Database,
  clock: Clock,
  defectId: string,
): Promise<DefectDetailsData | undefined> {
  const defect = await defectDetails(db, defectId);
  if (!defect) return undefined;
  const [machines, names] = await Promise.all([
    machineLabels(db, [defect.machineId]),
    teamMemberNames(
      db,
      defect.problemReports.flatMap(({ reporter }) => (reporter.kind === "team-member" ? [reporter.teamMemberId] : [])),
    ),
  ]);
  const machine = machines.get(defect.machineId);
  return {
    title: defect.title,
    museumNumber: machine?.museumNumber ?? "",
    machineModelTitle: machine?.machineModelTitle ?? "",
    priority: defect.priority,
    suitableForHelpers: defect.suitableForHelpers,
    openSince: defect.openSince,
    openHours: elapsedHours(defect.openSince, clock.now()),
    problemReports: defect.problemReports.map((report) => ({
      id: report.id,
      description: report.description,
      reporter:
        report.reporter.kind === "visitor"
          ? { kind: "visitor" }
          : { kind: "team-member", name: names.get(report.reporter.teamMemberId) },
      reportedAt: report.reportedAt,
      originating: report.originating,
    })),
  };
}
