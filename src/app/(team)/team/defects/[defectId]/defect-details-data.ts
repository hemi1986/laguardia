import { machineLabels } from "@/modules/collection";
import { defectDetails, type Priority } from "@/modules/repair";
import { teamMemberNames } from "@/modules/team";
import type { Clock } from "@/platform/clock";
import type { Database } from "@/platform/command";
import { calendarDate, daysBetween, today } from "@/platform/time";
import { photoViewAddresses } from "@/photo";
import { blobStorage } from "@/platform/storage";
import { photoAt, type PhotoSource } from "../../problem-report-photo";
import { shownReporter, type ShownReporter } from "../../reporter";

/** A problem report on the defect's page, its reporter named. */
export type ShownDefectProblemReport = {
  id: string;
  description: string;
  reporter: ShownReporter;
  reportedAt: Date;
  /** The photo (ST-016) at a short-lived address – issued only here, behind the team pages' access check (HS-1). */
  photo: { address: string } | undefined;
  originating: boolean;
};

/** A defect's own page (ST-021): its machine, title, priority, mark, how long it is open, and its problem reports. */
export type DefectDetailsData = {
  title: string;
  museumNumber: string;
  machineModelTitle: string;
  priority: Priority;
  suitableForHelpers: boolean;
  recordedAt: Date;
  /** Berlin calendar days it has been open – only for an open defect; resolved ones are shown by ST-028. */
  openDays: number | undefined;
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
  { storage = blobStorage() }: PhotoSource = {},
): Promise<DefectDetailsData | undefined> {
  const defect = await defectDetails(db, defectId);
  if (!defect) return undefined;
  const [machines, names, photos] = await Promise.all([
    machineLabels(db, [defect.machineId]),
    teamMemberNames(
      db,
      defect.problemReports.flatMap(({ reporter }) => (reporter.kind === "team-member" ? [reporter.teamMemberId] : [])),
    ),
    photoViewAddresses(
      storage,
      clock,
      defect.problemReports.flatMap(({ photo }) => (photo ? [photo] : [])),
    ),
  ]);
  const machine = machines.get(defect.machineId);
  return {
    title: defect.title,
    museumNumber: machine?.museumNumber ?? "",
    machineModelTitle: machine?.machineModelTitle ?? "",
    priority: defect.priority,
    suitableForHelpers: defect.suitableForHelpers,
    recordedAt: defect.recordedAt,
    openDays: defect.state === "open" ? daysBetween(calendarDate(defect.recordedAt), today(clock)) : undefined,
    problemReports: defect.problemReports.map((report) => ({
      id: report.id,
      description: report.description,
      reporter: shownReporter(report.reporter, names),
      reportedAt: report.reportedAt,
      photo: photoAt(photos, report.photo),
      originating: report.originating,
    })),
  };
}
