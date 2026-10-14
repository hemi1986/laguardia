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
export { priorities, type Defect, type Priority, type WorkLogEntry } from "./defect";
export {
  defectDetails,
  defectTitle,
  openDefectCounts,
  openDefects,
  openDefectTitles,
  type DefectDetails,
  type OpenDefect,
  type OpenDefectsQuery,
} from "./defects";
export type { DefectProblemReport } from "./problem-reports";
export { repairHistory, type RepairHistoryEntry } from "./repair-history";
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
export { claimDefectCommand, takenOverFrom } from "./claim-defect-command";
export { assigneeRefusal } from "./claim-defect";
export type { ClaimDefectError, ClaimDefectInput } from "./claim-defect";
export { releaseClaimCommand } from "./release-claim-command";
export type { ReleaseClaimError, ReleaseClaimInput } from "./release-claim";
export { prioritizeDefectCommand } from "./prioritize-defect-command";
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
} from "./defect-actions";
