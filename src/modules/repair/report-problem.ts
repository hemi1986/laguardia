import type { MachineStatus } from "@/modules/collection";
import type { ActorOf, Decision, DecisionContext, TeamMemberId } from "@/platform/command";

/**
 * CMD-ReportProblem (AGG-ProblemReport): a visitor or team member reports a problem with a machine.
 * The pure decision of a creating command – the command layer saves the new problem report at version 0. What it must
 * know about the machine comes in as its facts, read from the Collection module in the command's transaction (ST-013).
 * The team members' rule (any machine that is not retired) follows with ST-015.
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

/** The machine as the Collection module knows it now – undefined for an unknown machine. */
export type ReportingFacts = { machine: { machineStatus: MachineStatus; retired: boolean } | undefined };

export type ReportProblemError =
  | "machine-not-found"
  | "machine-not-on-display"
  | "description-required"
  | "description-too-long";

/** The longest description a problem report may have (ST-013) – the rejection names it. */
export const DESCRIPTION_MAX_LENGTH = 2000;

export function reportProblem(
  { machine }: ReportingFacts,
  input: ReportProblemInput,
  { actor, clock, newId }: DecisionContext<ReportingPerson>,
): Decision<ProblemReport, ProblemReported, ReportProblemError> {
  if (!machine) return { ok: false, error: "machine-not-found" };
  // Visitors report only for machines on display (CMD-ReportProblem rules); the page offers no button either (ST-010).
  if (actor.kind === "visitor" && machine.machineStatus === "not-on-display") {
    return { ok: false, error: "machine-not-on-display" };
  }
  const description = input.description.trim();
  if (!description) return { ok: false, error: "description-required" };
  if (description.length > DESCRIPTION_MAX_LENGTH) return { ok: false, error: "description-too-long" };
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
