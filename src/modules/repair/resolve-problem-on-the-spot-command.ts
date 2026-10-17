import { aggregateCommand } from "@/platform/command";
import { problemReports } from "./problem-reports";
import { resolveProblemOnTheSpot, resolvingActors } from "./resolve-problem-on-the-spot";
import { repairEvents } from "./events";

/**
 * CMD-ResolveProblemOnTheSpot through the command layer: a change of AGG-ProblemReport at the version the team member
 * saw (HS-16) – a concurrent triage is rejected as "already triaged" – emits EVT-ProblemResolvedOnTheSpot.
 */
export const resolveProblemOnTheSpotCommand = aggregateCommand({
  id: "CMD-ResolveProblemOnTheSpot",
  allowedActors: resolvingActors,
  store: problemReports,
  target: (input) => ({ id: input.problemReportId, version: input.version }),
  decide: resolveProblemOnTheSpot,
  journal: repairEvents.journal,
  result: (report) => ({ problemReportId: report.id }),
});
