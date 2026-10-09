import type { MachineStatus } from "@/modules/collection";
import type { ActorOf, Decision, DecisionContext, TeamMemberId } from "@/platform/command";

/**
 * CMD-ReportProblem (AGG-ProblemReport): a visitor or team member reports a problem with a machine.
 * The pure decision of a creating command – the command layer saves the new problem report at version 0. What it must
 * know about the machine comes in as its facts, read from the Collection module in the command's transaction (ST-013).
 * Team members may report for any machine that is not retired (ST-015).
 */

export type Reporter = { kind: "visitor" } | { kind: "team-member"; teamMemberId: TeamMemberId };

/** Who may report a problem – the allowed actors of CMD-ReportProblem. */
export const reportingActors = ["visitor", "helper", "technician"] as const;

type ReportingPerson = ActorOf<(typeof reportingActors)[number]>;

/** The outcomes of triage (CONTEXT.md: Triage) – exactly one per triaged problem report. */
export const triageOutcomes = ["defect-recorded", "linked", "resolved-on-the-spot", "dismissed"] as const;
export type TriageOutcome = (typeof triageOutcomes)[number];

/**
 * The Triage value object of AGG-ProblemReport (data model): the defect for *defect recorded* and *linked* (ST-018,
 * ST-022), the note for *resolved on the spot* (ST-019); its dismissal reason follows with ST-020.
 */
export type Triage = {
  outcome: TriageOutcome;
  triagedBy: TeamMemberId;
  triagedAt: Date;
  defectId?: string;
  note?: string;
};

/** AGG-ProblemReport – current state (docs/architecture/data-model.md). Untriaged until `triage` is set. */
export type ProblemReport = {
  id: string;
  machineId: string;
  description: string;
  reporter: Reporter;
  reportedAt: Date;
  /** The stored photo's reference (ST-016) – kept as long as the problem report; removed on spam dismissal (ST-020). */
  photo?: string;
  triage?: Triage;
};

export type ProblemReported = {
  type: "EVT-ProblemReported";
  problemReportId: string;
  machineId: string;
  description: string;
  reporter: Reporter;
  reportedAt: Date;
  photo?: string;
};

/** `photo`: the reference of a photo the photo module has stored for this problem report (ST-016) – optional. */
export type ReportProblemInput = { machineId: string; description: string; photo?: string };

/** The machine as the Collection module knows it now – undefined for an unknown machine. */
export type ReportingFacts = { machine: { machineStatus: MachineStatus; retired: boolean } | undefined };

export type ReportProblemError =
  | "machine-not-found"
  | "machine-retired"
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
  // Nobody reports for a retired machine (CMD-ReportProblem rules); team members may for any other one (ST-015).
  if (machine.retired) return { ok: false, error: "machine-retired" };
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
    ...(input.photo ? { photo: input.photo } : {}),
  };
  const { id: problemReportId, ...reported } = report;
  return { ok: true, state: report, events: [{ type: "EVT-ProblemReported", problemReportId, ...reported }] };
}

/** The one place a reporter is derived from the acting person (Q5/Q20). */
function reporterOf(actor: ReportingPerson): Reporter {
  return actor.kind === "team-member" ? { kind: "team-member", teamMemberId: actor.teamMemberId } : actor;
}
