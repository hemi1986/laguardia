import type { Actor, Decision, DecisionContext } from "@/platform/command";

/**
 * CMD-ReportProblem (AGG-ProblemReport): a visitor or team member reports a problem with a machine.
 * The pure decision of a creating command – the command layer saves the new problem report at version 0.
 * The rules on who may report for which machine (on display, retired) come with the machine's status (ST-013, ST-015).
 */

export type Reporter = { kind: "visitor" } | { kind: "team-member"; teamMemberId: string };

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
  { actor, clock, newId }: DecisionContext,
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
  return {
    ok: true,
    state: report,
    events: [{ type: "EVT-ProblemReported", problemReportId: report.id, ...rest(report) }],
  };
}

function rest({ machineId, description, reporter, reportedAt }: ProblemReport) {
  return { machineId, description, reporter, reportedAt };
}

/** The reporter is the acting person; the command allows visitors and team members only. */
function reporterOf(actor: Actor): Reporter {
  if (actor.kind === "team-member") return { kind: "team-member", teamMemberId: actor.teamMemberId };
  if (actor.kind === "visitor") return { kind: "visitor" };
  throw new Error("The system never reports a problem"); // excluded by allowedActors
}
