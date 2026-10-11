import type { ActorOf, Decision, DecisionContext } from "@/platform/command";
import { recordDefect, type DefectRecorded, type RecordDefectError, type RecordDefectInput } from "./record-defect";
import {
  reportProblem,
  type ProblemReport,
  type ProblemReported,
  type ReportingFacts,
  type ReportingPerson,
  type ReportProblemError,
  type ReportProblemInput,
} from "./report-problem";
import {
  resolveProblemOnTheSpot,
  type ProblemResolvedOnTheSpot,
  type ResolveProblemOnTheSpotError,
} from "./resolve-problem-on-the-spot";

/**
 * CMD-ReportProblem with its triage outcome in the same step (ST-023, ST-052): a technician's own problem report is
 * triaged when it is reported – a defect recorded, or the problem resolved on the spot. The decision of reporting runs
 * first, then the decision of the triage outcome's own command on the new problem report, so all rules of both apply,
 * and the command layer stores the problem report, its triage and a new defect together or not at all.
 */

/** The triage outcome chosen when reporting, with what its own command takes. */
export type TriageInTheSameStep =
  | ({ outcome: "defect-recorded" } & Omit<RecordDefectInput, "problemReportId" | "version">)
  | { outcome: "resolved-on-the-spot"; note: string };

export type ReportProblemAndTriageInput = ReportProblemInput & { triage?: TriageInTheSameStep };

/** A new problem report cannot have been triaged by someone else – every other rule of the outcome's command applies. */
export type ReportProblemAndTriageError =
  | ReportProblemError
  | TriageRequired
  | "not-authorized"
  | Exclude<RecordDefectError | ResolveProblemOnTheSpotError, "already-triaged">;

/** A technician's problem report without a triage outcome – rejected by the command itself (user, 2026-10-10). */
export type TriageRequired = "triage-required";

type TriageEvent = DefectRecorded | ProblemResolvedOnTheSpot;

export function reportProblemAndTriage(
  facts: ReportingFacts,
  input: ReportProblemAndTriageInput,
  context: DecisionContext<ReportingPerson>,
): Decision<ProblemReport, ProblemReported | TriageEvent, ReportProblemAndTriageError> {
  const { actor } = context;
  const technician =
    actor.kind === "team-member" && actor.role === "technician" ? { ...actor, role: actor.role } : undefined;
  // Recording a defect is for technicians only (CMD-RecordDefect) – a helper's or visitor's problem report with that
  // triage outcome is rejected as a whole, never stored without it (CMD-ReportProblem rules; user, 2026-10-11).
  if (input.triage && !technician) return { ok: false, error: "not-authorized" };
  const reported = reportProblem(facts, input, context);
  if (!reported.ok || !technician) return reported;
  // A technician's problem report is never stored untriaged, whatever form sent it (CMD-ReportProblem rules).
  if (!input.triage) return { ok: false, error: "triage-required" };
  const triaged = triage(reported.state, input.triage, { ...context, actor: technician }, facts);
  if (!triaged.ok) {
    if (triaged.error === "already-triaged") throw new Error("CMD-ReportProblem: a new problem report is untriaged");
    return { ok: false, error: triaged.error };
  }
  return { ...triaged, events: [...reported.events, ...triaged.events] };
}

/** The triage outcome's own decision on the new problem report – at version 0, which nobody else has seen. */
function triage(
  report: ProblemReport,
  chosen: TriageInTheSameStep,
  context: DecisionContext<ActorOf<"technician">>,
  facts: ReportingFacts,
): Decision<ProblemReport, TriageEvent, RecordDefectError | ResolveProblemOnTheSpotError> {
  const target = { problemReportId: report.id, version: 0 };
  if (chosen.outcome === "resolved-on-the-spot") {
    return resolveProblemOnTheSpot(report, { ...target, note: chosen.note }, context);
  }
  const { title, priority, suitableForHelpers, machineStatus, machineVersion } = chosen;
  return recordDefect(
    report,
    { ...target, title, priority, suitableForHelpers, machineStatus, machineVersion },
    context,
    facts,
  );
}
