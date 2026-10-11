import { machineLabels } from "@/modules/collection";
import {
  claimRefusal,
  defectDetails,
  logWorkRefusal,
  resolveRefusal,
  takenOverFrom,
  type Priority,
} from "@/modules/repair";
import { teamMemberNames } from "@/modules/team";
import type { Clock } from "@/platform/clock";
import type { Database } from "@/platform/command";
import { teamMessages } from "@/platform/messages";
import { calendarDate, daysBetween, today } from "@/platform/time";
import { photoViewAddresses } from "@/photo";
import { blobStorage } from "@/platform/storage";
import { photoAt, type PhotoSource } from "../../problem-report-photo";
import { shownReporter, type ShownReporter } from "../../reporter";
import { shownClaimant, type ShownClaimant, type Viewer } from "../../claimant";

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
  /**
   * Whom the claimant took it over from, by name – only for the claimant just back from claiming, for the confirmation
   * (G3); undefined otherwise.
   */
  takenOverFrom: string | undefined;
  /** Whether the team member looking at the page may claim it – or take it over (G11). */
  canClaim: boolean;
  /** How it ended (ST-028) – only for a resolved defect: the closing note, who resolved it, by name, and when. */
  resolution: { closingNote: string; resolvedBy: string; resolvedAt: Date; you: boolean } | undefined;
  /** Whether the team member looking at the page may resolve it (G11). */
  canResolve: boolean;
  /** Its work log (ST-024), the newest entry first – who logged it by name. */
  workLog: ShownWorkLogEntry[];
  /** Whether the newest entry is the viewer's own – for the confirmation just after logging work (G3). */
  youLoggedLast: boolean;
  /** Whether work can be logged on it as it is – every team member may (HS-8, G11). */
  canLogWork: boolean;
};

/** A work log entry on the defect's page. */
export type ShownWorkLogEntry = {
  id: string;
  whatWasDone: string;
  partsUsed: string | undefined;
  loggedBy: string;
  loggedAt: Date;
};

/**
 * The defect page's data: Repair's defect with its problem reports, Collection's museum number and title, Team's names
 * – the page composes the modules' public queries (ST-009). Undefined when there is no such defect. `viewer` is the
 * team member looking at the page: whether they may claim the defect, and whether its claim is theirs (ST-025);
 * `justClaimed` says they are just back from claiming it.
 */
export async function loadDefectDetails(
  db: Database,
  clock: Clock,
  defectId: string,
  {
    storage = blobStorage(),
    viewer,
    justClaimed = false,
  }: PhotoSource & { viewer?: Viewer; justClaimed?: boolean } = {},
): Promise<DefectDetailsData | undefined> {
  const defect = await defectDetails(db, defectId);
  if (!defect) return undefined;
  // Read only for the confirmation: the claimant, just back from claiming.
  const previousClaimant =
    justClaimed && defect.claim && defect.claim.claimedBy === viewer?.id
      ? await takenOverFrom(db, defect.id, defect.claim.claimedBy)
      : undefined;
  const [machines, names, photos] = await Promise.all([
    machineLabels(db, [defect.machineId]),
    teamMemberNames(db, [
      ...defect.problemReports.flatMap(({ reporter }) =>
        reporter.kind === "team-member" ? [reporter.teamMemberId] : [],
      ),
      ...(defect.claim ? [defect.claim.claimedBy] : []),
      ...(previousClaimant ? [previousClaimant] : []),
      ...(defect.resolution ? [defect.resolution.resolvedBy] : []),
      ...defect.workLog.map((entry) => entry.loggedBy),
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
    claimant: shownClaimant(defect.claim?.claimedBy, names, viewer),
    takenOverFrom: previousClaimant && (names.get(previousClaimant) ?? teamMessages.machineRecord.unknownTeamMember),
    // CMD-ClaimDefect's own rule, asked so nobody is shown a button that can only be rejected (G11).
    canClaim: !!viewer && claimRefusal(defect, { teamMemberId: viewer.id, role: viewer.role }) === undefined,
    resolution: defect.resolution && {
      closingNote: defect.resolution.closingNote,
      resolvedBy: names.get(defect.resolution.resolvedBy) ?? teamMessages.machineRecord.unknownTeamMember,
      resolvedAt: defect.resolution.resolvedAt,
      you: defect.resolution.resolvedBy === viewer?.id,
    },
    // CMD-ResolveDefect's own rule, asked like the claim's (G11).
    canResolve: !!viewer && resolveRefusal(defect, viewer) === undefined,
    workLog: defect.workLog
      .map((entry) => ({
        ...entry,
        loggedBy: names.get(entry.loggedBy) ?? teamMessages.machineRecord.unknownTeamMember,
      }))
      .reverse(),
    youLoggedLast: !!viewer && defect.workLog.at(-1)?.loggedBy === viewer.id,
    canLogWork: !!viewer && logWorkRefusal(defect) === undefined,
  };
}
