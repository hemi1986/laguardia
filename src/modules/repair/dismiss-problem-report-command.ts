import { aggregateCommand } from "@/platform/command";
import { dismissingActors, dismissProblemReport } from "./dismiss-problem-report";
import { problemReports } from "./problem-reports";
import { repairEvents } from "./events";

/**
 * CMD-DismissProblemReport through the command layer: a change of AGG-ProblemReport at the version the technician saw
 * (HS-16) – a concurrent triage is rejected as "already triaged" – emits EVT-ProblemReportDismissed. The result names
 * the photo a spam dismissal removed; the caller deletes it from the storage after the commit (ADR 0007).
 */
export const dismissProblemReportCommand = aggregateCommand({
  id: "CMD-DismissProblemReport",
  allowedActors: dismissingActors,
  store: problemReports,
  target: (input) => ({ id: input.problemReportId, version: input.version }),
  decide: dismissProblemReport,
  journal: repairEvents.journal,
  result: (report, events) => ({
    problemReportId: report.id,
    removedPhoto: events.find((event) => event.removedPhoto)?.removedPhoto,
  }),
});
