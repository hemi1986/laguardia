import type { ActorOf, Decision, DecisionContext, TeamMemberId } from "@/platform/command";

/**
 * CMD-ReportProblem (AGG-ProblemReport): a visitor or team member reports a problem with a machine.
 * The pure decision of a creating command – the command layer saves the new problem report at version 0.
 * The rules on who may report for which machine (on display, retired) come with the machine's status (ST-013, ST-015).
 */

export type Reporter = { kind: "visitor" } | { kind: "team-member"; teamMemberId: TeamMemberId };

/** Who may report a problem – the allowed actors of CMD-ReportProblem. */
export const reportingActors = ["visitor", "helper", "technician"] as const;

type ReportingPerson = ActorOf<(typeof reportingActors)[number]>;

/** AGG-ProblemReport – current state (docs/architecture/data-model.md). Triage follows with ST-018 ff. */
export type ProblemReport = {
  id: string;
  machineId: string;
  description: string;
  reporter: Reporter;
  reportedAt: Date;
};

export type ProblemReported = {
  type: "EVT-ProblemReported";
  problemReportId: string;
  machineId: string;
  description: string;
  reporter: Reporter;
  reportedAt: Date;
};

export type ReportProblemInput = { machineId: string; description: string };

export function reportProblem(
  _nothingYet: undefined,
  input: ReportProblemInput,
  { actor, clock, newId }: DecisionContext<ReportingPerson>,
): Decision<ProblemReport, ProblemReported, "description-required"> {
  const description = input.description.trim();
  if (!description) return { ok: false, error: "description-required" };
  const report: ProblemReport = {
    id: newId(),
    machineId: input.machineId,
    description,
    reporter: reporterOf(actor),
    reportedAt: clock.now(),
  };
  const { id: problemReportId, ...reported } = report;
  return { ok: true, state: report, events: [{ type: "EVT-ProblemReported", problemReportId, ...reported }] };
}

/** The one place a reporter is derived from the acting person (Q5/Q20). */
function reporterOf(actor: ReportingPerson): Reporter {
  return actor.kind === "team-member" ? { kind: "team-member", teamMemberId: actor.teamMemberId } : actor;
}
