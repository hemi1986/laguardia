import { collectionChangesIn, type MachineStatus } from "@/modules/collection";
import {
  aiDependencies,
  defectAiAssessments,
  type AiDependencies,
  type DefectAiAssessments,
} from "@/modules/ai-assistance";
import {
  defectActions,
  defectDetails,
  defectActionIn,
  resolutionsAndReopenings,
  type DefectAction,
  type DefectRepairTimes,
  type HoldReason,
  type Priority,
} from "@/modules/repair";
import type { Clock } from "@/platform/clock";
import { lastCommandBy, type Database } from "@/platform/command";
import { calendarDate, daysBetween, today } from "@/platform/time";
import { photoViewAddresses } from "@/photo";
import { s3Storage } from "@/platform/storage";
import { photoAt, type PhotoSource } from "../../team-photos";
import { shownReporter, type ShownReporter } from "../../reporter";
import { shownClaimant, type ShownClaimant, type Viewer } from "../../claimant";
import { named } from "../../named";
import { shownAiAssessmentData, type ShownAiAssessmentData } from "../../ai-assessment-data";

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
  /** The section „KI-Einschätzungen“ (ST-107, RM-DefectAiAssessments) – hidden while AI is off and none exists. */
  aiAssessments: DefectAiAssessmentsData;
};

/** A resolution or a reopening on the defect's page. */
export type ShownResolutionOrReopening =
  | { kind: "resolution"; id: string; closingNote: string; resolvedBy: string; resolvedAt: Date }
  | ({ kind: "reopening"; id: string; reopenedBy: string; reopenedAt: Date } & (
      { reason: string; problemReport?: never } | { problemReport: { id: string; description: string }; reason?: never }
    ));

/** A work log entry on the defect's page. */
export type ShownWorkLogEntry = {
  id: string;
  whatWasDone: string;
  partsUsed: string | undefined;
  /** Its photos at their short-lived addresses (ST-032) – those no address could be issued for are left out. */
  photos: { address: string }[];
  loggedBy: string;
  loggedAt: Date;
};

/** The section „KI-Einschätzungen“ of the defect's page – RM-DefectAiAssessments (ST-107, ST-111). */
export type DefectAiAssessmentsData = Omit<DefectAiAssessments, "current" | "earlier"> & {
  current: ShownAiAssessmentData | undefined;
  earlier: ShownAiAssessmentData[];
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
  {
    storage = s3Storage(),
    viewer,
    done,
    ai = aiDependencies(),
  }: PhotoSource & { viewer?: Viewer; done?: DefectAction; ai?: AiDependencies } = {},
): Promise<DefectDetailsData | undefined> {
  const defect = await defectDetails(db, defectId, viewer && { teamMemberId: viewer.id, role: viewer.role });
  if (!defect) return undefined;
  const aiAssessments = await defectAiAssessments(db, {
    defectId: defect.id,
    viewer: viewer && { teamMemberId: viewer.id, role: viewer.role },
    dependencies: ai,
  });
  // Read only for the confirmation – once: someone just back from an action (G3). Repair says which action the command
  // did, Collection whether it changed the machine status in the same step (reopening, ST-030).
  const command = done && viewer ? await lastCommandBy(db, { aggregateId: defect.id }, viewer.id) : undefined;
  const last = command && defectActionIn(command, defect.id);
  const confirmed = last?.action === done ? last : undefined;
  const previousClaimant = confirmed?.takenOverFrom;
  const releasedClaimOf = confirmed?.changedDetails?.releasedClaimOf;
  const assignedBy = defect.claim?.assignedBy;
  const [shown, photos] = await Promise.all([
    named(db, {
      machines: [defect.machineId],
      teamMembers: [
        ...defect.problemReports.map(({ reporter }) =>
          reporter.kind === "team-member" ? reporter.teamMemberId : undefined,
        ),
        defect.claim?.claimedBy,
        assignedBy,
        previousClaimant,
        releasedClaimOf,
        confirmed?.assignedTo,
        ...defect.resolutions.map((resolution) => resolution.resolvedBy),
        ...defect.reopenings.map((reopening) => reopening.reopenedBy),
        ...defect.workLog.map((entry) => entry.loggedBy),
        aiAssessments.current?.requestedBy,
        ...aiAssessments.earlier.map((assessment) => assessment.requestedBy),
      ],
    }),
    photoViewAddresses(storage, clock, [
      ...defect.problemReports.flatMap(({ photo }) => (photo ? [photo] : [])),
      ...defect.workLog.flatMap((entry) => entry.photos),
      ...(aiAssessments.current?.photos ?? []),
      ...aiAssessments.earlier.flatMap((assessment) => assessment.photos),
    ]),
  ]);
  // A status change made while reopening (ST-030) is confirmed when the same command changed it – the journal says so,
  // not the address (architecture review 2026-10-18).
  const newMachineStatus =
    confirmed?.action === "reopen" && command
      ? collectionChangesIn(command, defect.machineId).statusChangedTo
      : undefined;
  return {
    title: defect.title,
    ...shown.label(defect.machineId),
    priority: defect.priority,
    suitableForHelpers: defect.suitableForHelpers,
    recordedAt: defect.recordedAt,
    repairTimes: defect.repairTimes,
    openDays: defect.state === "open" ? daysBetween(calendarDate(defect.recordedAt), today(clock)) : undefined,
    problemReports: defect.problemReports.map((report) => ({
      id: report.id,
      description: report.description,
      reporter: shownReporter(report.reporter, shown),
      reportedAt: report.reportedAt,
      photo: photoAt(photos, report.photo),
      originating: report.originating,
    })),
    id: defect.id,
    version: defect.version,
    claimant: shownClaimant(defect.claim?.claimedBy, shown, viewer),
    hold: defect.hold && { reason: defect.hold.reason, note: defect.hold.note },
    assignedBy: shownClaimant(assignedBy, shown, viewer),
    // The commands' own rules, asked so nobody is shown a control that can only be rejected (G11).
    offered: defectActions.filter((action) => defect.actions && defect.actions[action] === undefined),
    confirmed: confirmed && {
      action: confirmed.action,
      takenOverFrom: previousClaimant && shown.name(previousClaimant),
      // Whom it was assigned to is its claimant: the assignment is the defect's latest event.
      assignedTo: confirmed.assignedTo && shown.name(confirmed.assignedTo),
      newMachineStatus,
      changedDetails: confirmed.changedDetails && {
        ...confirmed.changedDetails,
        releasedClaimOf: releasedClaimOf && shown.name(releasedClaimOf),
      },
    },
    resolutionsAndReopenings: resolutionsAndReopenings(defect).map((step) =>
      step.kind === "resolution"
        ? { ...step, resolvedBy: shown.name(step.resolvedBy) }
        : { ...step, reopenedBy: shown.name(step.reopenedBy) },
    ),
    workLog: defect.workLog
      .map((entry) => ({
        ...entry,
        loggedBy: shown.name(entry.loggedBy),
        photos: entry.photos.flatMap((photo) => photoAt(photos, photo) ?? []),
      }))
      .reverse(),
    aiAssessments: {
      ...aiAssessments,
      current: aiAssessments.current && shownAiAssessmentData(aiAssessments.current, shown, photos),
      earlier: aiAssessments.earlier.map((assessment) => shownAiAssessmentData(assessment, shown, photos)),
    },
  };
}
