import { collectionChangesIn, machineLabels, type MachineStatus } from "@/modules/collection";
import {
  defectActions,
  defectDetails,
  lastDefectActionBy,
  resolutionsAndReopenings,
  type DefectAction,
  type DefectRepairTimes,
  type HoldReason,
  type Priority,
} from "@/modules/repair";
import { teamMemberNames } from "@/modules/team";
import type { Clock } from "@/platform/clock";
import { lastCommandBy, type Database } from "@/platform/command";
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
  /** Its two times (ST-051), in milliseconds – each only once it exists. */
  repairTimes: DefectRepairTimes;
  problemReports: ShownDefectProblemReport[];
  /** The defect and the version this page shows – what its claim form posts (ST-025, HS-16). */
  id: string;
  version: number;
  /** Its claimant, if any (ST-025). */
  claimant: ShownClaimant | undefined;
  /** Why it waits and the note to it, if it is on hold (ST-029). */
  hold: { reason: HoldReason; note: string | undefined } | undefined;
  /** The technician who assigned it to its claimant, if one did (ST-026) – by name, and whether it is the viewer. */
  assignedBy: ShownClaimant | undefined;
  /** What the team member looking at the page can do to it, in the order the page offers it (G11, G21). */
  offered: DefectAction[];
  /**
   * What that team member just did to it – for the confirmation (G3); after a claim with whom it was taken over from,
   * after an assignment also with whom it was assigned to, by name. Undefined unless they are just back from doing it
   * and nobody acted since.
   */
  confirmed:
    | {
        action: DefectAction;
        takenOverFrom: string | undefined;
        assignedTo: string | undefined;
        /** The machine's status after reopening with a status change in the same step (ST-030, as in ST-018). */
        newMachineStatus: MachineStatus | undefined;
        /** After a change of its details: which changed, and whose claim that released, by name (ST-031). */
        changedDetails:
          { title: boolean; suitableForHelpers: boolean; releasedClaimOf: string | undefined } | undefined;
      }
    | undefined;
  /**
   * How it ended each time and why it was reopened (ST-028, ST-030) – the oldest first, each reopening after the
   * resolution it followed; team members by name. Empty while it was never resolved.
   */
  resolutionsAndReopenings: ShownResolutionOrReopening[];
  /** Its work log (ST-024), the newest entry first – who logged it by name. */
  workLog: ShownWorkLogEntry[];
};

/** A resolution or a reopening on the defect's page. */
export type ShownResolutionOrReopening =
  | { kind: "resolution"; id: string; closingNote: string; resolvedBy: string; resolvedAt: Date }
  | { kind: "reopening"; id: string; reason: string; reopenedBy: string; reopenedAt: Date };

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
  { storage = blobStorage(), viewer, done }: PhotoSource & { viewer?: Viewer; done?: DefectAction } = {},
): Promise<DefectDetailsData | undefined> {
  const defect = await defectDetails(db, defectId, viewer && { teamMemberId: viewer.id, role: viewer.role });
  if (!defect) return undefined;
  // Read only for the confirmation: someone just back from an action.
  const last = done && viewer ? await lastDefectActionBy(db, defect.id, viewer.id) : undefined;
  const confirmed = last?.action === done ? last : undefined;
  const previousClaimant = confirmed?.takenOverFrom;
  const releasedClaimOf = confirmed?.changedDetails?.releasedClaimOf;
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
      ...(releasedClaimOf ? [releasedClaimOf] : []),
      ...defect.resolutions.map((resolution) => resolution.resolvedBy),
      ...defect.reopenings.map((reopening) => reopening.reopenedBy),
      ...defect.workLog.map((entry) => entry.loggedBy),
    ]),
    photoViewAddresses(
      storage,
      clock,
      defect.problemReports.flatMap(({ photo }) => (photo ? [photo] : [])),
    ),
  ]);
  const machine = machines.get(defect.machineId);
  // A status change made while reopening (ST-030) is confirmed when the same command changed it – the journal says so,
  // not the address (architecture review 2026-10-18).
  const reopening =
    confirmed?.action === "reopen" && viewer
      ? await lastCommandBy(db, { aggregateId: defect.id }, viewer.id)
      : undefined;
  const newMachineStatus = reopening && collectionChangesIn(reopening, defect.machineId).statusChangedTo;
  return {
    title: defect.title,
    museumNumber: machine?.museumNumber ?? "",
    machineModelTitle: machine?.machineModelTitle ?? "",
    priority: defect.priority,
    suitableForHelpers: defect.suitableForHelpers,
    recordedAt: defect.recordedAt,
    repairTimes: defect.repairTimes,
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
    hold: defect.hold && { reason: defect.hold.reason, note: defect.hold.note },
    assignedBy: shownClaimant(assignedBy, names, viewer),
    // The commands' own rules, asked so nobody is shown a control that can only be rejected (G11).
    offered: defectActions.filter((action) => defect.actions && defect.actions[action] === undefined),
    confirmed: confirmed && {
      action: confirmed.action,
      takenOverFrom: previousClaimant && nameOf(names, previousClaimant),
      // Whom it was assigned to is its claimant: the assignment is the defect's latest event.
      assignedTo: confirmed.assignedTo && nameOf(names, confirmed.assignedTo),
      newMachineStatus,
      changedDetails: confirmed.changedDetails && {
        ...confirmed.changedDetails,
        releasedClaimOf: releasedClaimOf && nameOf(names, releasedClaimOf),
      },
    },
    resolutionsAndReopenings: resolutionsAndReopenings(defect).map((step) =>
      step.kind === "resolution"
        ? { ...step, resolvedBy: nameOf(names, step.resolvedBy) }
        : { ...step, reopenedBy: nameOf(names, step.reopenedBy) },
    ),
    workLog: defect.workLog
      .map((entry) => ({
        ...entry,
        loggedBy: nameOf(names, entry.loggedBy),
      }))
      .reverse(),
  };
}
