import { defineCommand, type Actor } from "@/platform/command";
import { saveProblemReported } from "./problem-reports";
import { reportProblem, type Reporter } from "./report-problem";

/**
 * CMD-ReportProblem through the command layer: visitors and team members report; the reporter is the acting person.
 * Emits EVT-ProblemReported for AGG-ProblemReport.
 */
export const reportProblemCommand = defineCommand({
  id: "CMD-ReportProblem",
  allowedActors: ["visitor", "helper", "technician"],
  run: async (input: { machineId: string; description: string }, { tx, actor, clock, newId }) => {
    const outcome = reportProblem({ ...input, reporter: reporterOf(actor) }, { clock, newId });
    if (!outcome.ok) return outcome;
    const { event } = outcome;
    await saveProblemReported(tx, event);
    return {
      ok: true as const,
      result: { problemReportId: event.problemReportId },
      events: [
        {
          type: event.type,
          aggregate: { type: "AGG-ProblemReport" as const, id: event.problemReportId },
          machineId: event.machineId,
          data: { description: event.description, reporter: event.reporter },
        },
      ],
    };
  },
});

function reporterOf(actor: Actor): Reporter {
  if (actor.kind === "team-member") return { kind: "team-member", teamMemberId: actor.teamMemberId };
  if (actor.kind === "visitor") return { kind: "visitor" };
  throw new Error("The system never reports a problem"); // excluded by allowedActors
}
