import { machineLabels } from "@/modules/collection";
import { defectActions, defectDetails, lastDefectActionBy, type DefectAction, type Priority } from "@/modules/repair";
import { teamMemberNames } from "@/modules/team";
import type { Clock } from "@/platform/clock";
import type { Database } from "@/platform/command";
import { calendarDate, daysBetween, today } from "@/platform/time";
import { photoViewAddresses } from "@/photo";
import { blobStorage } from "@/platform/storage";
import { photoAt, type PhotoSource } from "../../problem-report-photo";
import { shownReporter, type ShownReporter } from "../../reporter";
import { nameOf, shownClaimant, type ShownClaimant, type Viewer } from "../../claimant";

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
  /** The technician who assigned it to its claimant, if one did (ST-026) – by name, and whether it is the viewer. */
  assignedBy: ShownClaimant | undefined;
  /** What the team member looking at the page can do to it, in the order the page offers it (G11, G21). */
  offered: DefectAction[];
  /**
   * What that team member just did to it – for the confirmation (G3); after a claim with whom it was taken over from,
   * after an assignment also with whom it was assigned to, by name. Undefined unless they are just back from doing it
   * and nobody acted since.
   */
  confirmed: { action: DefectAction; takenOverFrom: string | undefined; assignedTo: string | undefined } | undefined;
  /** How it ended (ST-028) – only for a resolved defect: the closing note, who resolved it, by name, and when. */
  resolution: { closingNote: string; resolvedBy: string; resolvedAt: Date } | undefined;
  /** Its work log (ST-024), the newest entry first – who logged it by name. */
  workLog: ShownWorkLogEntry[];
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
 * team member looking at the page: what they can do to the defect, and whether its claim is theirs; `done` is the
 * action the address says they just did (`?done=claim`) – confirmed only if the defect's journal says so too.
 */
export async function loadDefectDetails(
  db: Database,
  clock: Clock,
  defectId: string,
  { storage = blobStorage(), viewer, done }: PhotoSource & { viewer?: Viewer; done?: string } = {},
): Promise<DefectDetailsData | undefined> {
  const defect = await defectDetails(db, defectId, viewer && { teamMemberId: viewer.id, role: viewer.role });
  if (!defect) return undefined;
  // Read only for the confirmation: someone just back from an action.
  const last = done && viewer ? await lastDefectActionBy(db, defect.id, viewer.id) : undefined;
  const confirmed = last?.action === done ? last : undefined;
  const previousClaimant = confirmed?.takenOverFrom;
  const assignedBy = defect.claim?.assignedBy;
  const [machines, names, photos] = await Promise.all([
    machineLabels(db, [defect.machineId]),
    teamMemberNames(db, [
      ...defect.problemReports.flatMap(({ reporter }) =>
        reporter.kind === "team-member" ? [reporter.teamMemberId] : [],
      ),
      ...(defect.claim ? [defect.claim.claimedBy] : []),
      ...(assignedBy ? [assignedBy] : []),
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
    assignedBy: shownClaimant(assignedBy, names, viewer),
    // The commands' own rules, asked so nobody is shown a control that can only be rejected (G11).
    offered: defectActions.filter((action) => defect.actions && defect.actions[action] === undefined),
    confirmed: confirmed && {
      action: confirmed.action,
      takenOverFrom: previousClaimant && (nameOf(names, previousClaimant)),
      // Whom it was assigned to is its claimant: the assignment is the defect's latest event.
      assignedTo:
        confirmed.assignedTo && (nameOf(names, confirmed.assignedTo)),
    },
    resolution: defect.resolution && {
      closingNote: defect.resolution.closingNote,
      resolvedBy: nameOf(names, defect.resolution.resolvedBy),
      resolvedAt: defect.resolution.resolvedAt,
    },
    workLog: defect.workLog
      .map((entry) => ({
        ...entry,
        loggedBy: nameOf(names, entry.loggedBy),
      }))
      .reverse(),
  };
}
