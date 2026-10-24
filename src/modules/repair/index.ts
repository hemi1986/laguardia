/** Public interface of the Repair module (BC-Repair) – other modules and the app import only from here (ADR 0002). */
export {
  problemReportsOfMachine,
  problemReportForTriage,
  triageList,
  untriagedProblemReportCount,
  type TriageListEntry,
} from "./problem-reports";
export { reportProblemAndTriageCommand, reportProblemCommand } from "./report-problem-command";
export type { ReportProblemAndTriageInput } from "./report-problem-and-triage";
export { recordDefectCommand } from "./record-defect-command";
export { stricterMachineStatuses, type RecordDefectError, type RecordDefectInput } from "./record-defect";
export { resolveProblemOnTheSpotCommand } from "./resolve-problem-on-the-spot-command";
export type { ResolveProblemOnTheSpotError, ResolveProblemOnTheSpotInput } from "./resolve-problem-on-the-spot";
export {
  holdReasons,
  priorities,
  resolutionsAndReopenings,
  type Defect,
  type Hold,
  type HoldReason,
  type Priority,
  type ResolutionOrReopening,
  type WorkLogEntry,
} from "./defect";
export { putDefectOnHoldCommand } from "./put-defect-on-hold-command";
export type { PutDefectOnHoldError, PutDefectOnHoldInput } from "./put-defect-on-hold";
export { resumeDefectCommand } from "./resume-defect-command";
export { reopenDefectCommand } from "./reopen-defect-command";
export type { ReopenDefectError, ReopenDefectInput } from "./reopen-defect";
export type { ResumeDefectError, ResumeDefectInput } from "./resume-defect";
export {
  defectDetails,
  defectForAction,
  defectTitle,
  openDefectCounts,
  openDefects,
  openDefectTitles,
  resolvedOrReopenedSince,
  staleClaims,
  type DefectDetails,
  type DefectForAction,
  type OpenDefect,
  type OpenDefectsQuery,
  type ResolvedOrReopened,
  type StaleClaim,
} from "./defects";
export type { DefectProblemReport } from "./problem-reports";
export {
  recentRepairHistory,
  repairHistory,
  type EndedRepairHistoryEntry,
  type RepairHistoryEntry,
} from "./repair-history";
export type { Reporter } from "./report-problem";
export { dismissProblemReportCommand } from "./dismiss-problem-report-command";
export {
  reasonsByHand,
  type DismissProblemReportError,
  type DismissProblemReportInput,
} from "./dismiss-problem-report";
export type { DismissalReason } from "./report-problem";
export { linkProblemReportToDefectCommand } from "./link-problem-report-to-defect-command";
export type { LinkProblemReportToDefectError, LinkProblemReportToDefectInput } from "./link-problem-report-to-defect";
export { claimDefectCommand } from "./claim-defect-command";
export { assigneeRefusal } from "./claim-defect";
export type { ClaimDefectError, ClaimDefectInput } from "./claim-defect";
export { releaseClaimCommand } from "./release-claim-command";
export type { ReleaseClaimError, ReleaseClaimInput } from "./release-claim";
export { prioritizeDefectCommand } from "./prioritize-defect-command";
export { changeDefectDetailsCommand } from "./change-defect-details-command";
export { claimReleasedByRemovingTheMark } from "./change-defect-details";
export type { ChangeDefectDetailsError, ChangeDefectDetailsInput, DefectDetail } from "./change-defect-details";
export { priorityRefusal } from "./prioritize-defect";
export type { PrioritizeDefectError, PrioritizeDefectInput } from "./prioritize-defect";
export { resolveDefectCommand } from "./resolve-defect-command";
export type { ResolveDefectError, ResolveDefectInput } from "./resolve-defect";
export { logWorkCommand } from "./log-work-command";
export type { LogWorkError, LogWorkInput } from "./log-work";
export {
  defectActions,
  lastDefectActionBy,
  type DefectAction,
  type DefectActionRefusals,
  type DefectTeamMember,
  type LastDefectAction,
} from "./defect-actions";
export { defectActionCommands } from "./defect-action-commands";
export { problemReportedIn, triageOutcomeIn, type TriagedInCommand } from "./in-command";
export { retireMachineCommand, retirementConsequences } from "./retirement-policies";
