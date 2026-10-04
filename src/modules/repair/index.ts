/** Public interface of the Repair module (BC-Repair) – other modules and the app import only from here (ADR 0002). */
export {
  problemReportsOfMachine,
  problemReportForTriage,
  triageList,
  untriagedProblemReportCount,
  type TriageListEntry,
} from "./problem-reports";
export { reportProblemCommand } from "./report-problem-command";
export { recordDefectCommand } from "./record-defect-command";
export { stricterMachineStatuses, type RecordDefectError, type RecordDefectInput } from "./record-defect";
export { priorities, type Defect, type Priority } from "./defect";
export {
  defectDetails,
  defectTitle,
  openDefects,
  openDefectTitles,
  type DefectDetails,
  type OpenDefect,
  type OpenDefectsQuery,
} from "./defects";
export type { DefectProblemReport } from "./problem-reports";
export type { Reporter } from "./report-problem";
