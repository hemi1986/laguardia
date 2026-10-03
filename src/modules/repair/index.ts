/** Public interface of the Repair module (BC-Repair) – other modules and the app import only from here (ADR 0002). */
export {
  problemReportsOfMachine,
  problemReportForTriage,
  triageList,
  untriagedProblemReportCount,
  type TriageListEntry,
} from "./problem-reports";
export { reportProblemCommand } from "./report-problem-command";
export type { Reporter } from "./report-problem";
