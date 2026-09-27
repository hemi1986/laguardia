/** Public interface of the Repair module (BC-Repair) – other modules and the app import only from here (ADR 0002). */
export { problemReportsOfMachine, saveProblemReported } from "./problem-reports";
export { reportProblem, type ProblemReported, type Reporter, type ReportProblemInput } from "./report-problem";
