import { holdAgainstRetirement } from "@/modules/collection";
import { aggregateCommand } from "@/platform/command";
import { linkingFacts } from "./defects";
import { linkingActors, linkProblemReportToDefect } from "./link-problem-report-to-defect";
import { problemReports } from "./problem-reports";
import { repairEvents } from "./events";

/**
 * CMD-LinkProblemReportToDefect through the command layer: a change of AGG-ProblemReport at the version the technician
 * saw (HS-16) – a concurrent triage is rejected as "already triaged" – emits EVT-ProblemReportLinkedToDefect. Its facts
 * are the chosen defect as stored now; the defect itself is not changed. Before the defect's row lock it takes the
 * machine's retirement lock from Collection (ADR 0010) – linking to a resolved defect reopens it
 * from ST-053 on, and the lock order is the same as the retirement's: the advisory lock first, then the defect.
 */
export const linkProblemReportToDefectCommand = aggregateCommand({
  id: "CMD-LinkProblemReportToDefect",
  allowedActors: linkingActors,
  store: problemReports,
  target: (input) => ({ id: input.problemReportId, version: input.version }),
  facts: async (tx, input, report) => {
    await holdAgainstRetirement(tx, report.machineId);
    return linkingFacts(tx, input);
  },
  decide: linkProblemReportToDefect,
  journal: repairEvents.journal,
  result: (report) => ({ problemReportId: report.id, defectId: report.triage?.defectId ?? "" }),
});
