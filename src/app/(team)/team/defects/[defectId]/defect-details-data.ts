import { machineLabels } from "@/modules/collection";
import { defectDetails, type Priority } from "@/modules/repair";
import { teamMemberNames } from "@/modules/team";
import type { Clock } from "@/platform/clock";
import type { Database, Role } from "@/platform/command";
import { calendarDate, daysBetween, today } from "@/platform/time";
import { photoViewAddresses } from "@/photo";
import { blobStorage } from "@/platform/storage";
import { photoAt, type PhotoSource } from "../../problem-report-photo";
import { shownReporter, type ShownReporter } from "../../reporter";
import { shownClaimant, type ShownClaimant } from "../open-defects-data";

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
  /** The defect and the version this page shows – what its claim form posts (ST-025, HS-16). */
  id: string;
  version: number;
  /** Its claimant, if any (ST-025). */
  claimant: ShownClaimant | undefined;
  /** Whom the claimant took it over from, by name – for the confirmation after taking over (G3). */
  takenOverFrom: string | undefined;
  /** Whether the team member looking at the page may claim it – or take it over (G11). */
  canClaim: boolean;
};

/** The team member looking at a page. */
export type Viewer = { id: string; role: Role };

/**
 * The defect page's data: Repair's defect with its problem reports, Collection's museum number and title, Team's names
 * – the page composes the modules' public queries (ST-009). Undefined when there is no such defect. `viewer` is the
 * team member looking at the page: whether they may claim the defect, and whether its claim is theirs (ST-025).
 */
export async function loadDefectDetails(
  db: Database,
  clock: Clock,
  defectId: string,
  { storage = blobStorage(), viewer }: PhotoSource & { viewer?: Viewer } = {},
): Promise<DefectDetailsData | undefined> {
  const defect = await defectDetails(db, defectId);
  if (!defect) return undefined;
  const [machines, names, photos] = await Promise.all([
    machineLabels(db, [defect.machineId]),
    teamMemberNames(db, [
      ...defect.problemReports.flatMap(({ reporter }) =>
        reporter.kind === "team-member" ? [reporter.teamMemberId] : [],
      ),
      ...(defect.claim
        ? [defect.claim.claimedBy, ...(defect.claim.takenOverFrom ? [defect.claim.takenOverFrom] : [])]
        : []),
    ]),
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
    id: defect.id,
    version: defect.version,
    claimant: shownClaimant(defect.claim?.claimedBy, names, viewer?.id),
    takenOverFrom: defect.claim?.takenOverFrom && names.get(defect.claim.takenOverFrom),
    // The rules of CMD-ClaimDefect, so nobody is shown a button that can only be rejected (G11) – the command decides.
    canClaim:
      !!viewer &&
      defect.state === "open" &&
      (viewer.role === "technician" || defect.suitableForHelpers) &&
      defect.claim?.claimedBy !== viewer.id,
  };
}
