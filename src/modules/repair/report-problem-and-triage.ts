import type { ActorOf, Decision, DecisionContext } from "@/platform/command";
import {
  linkProblemReportToDefect,
  type LinkingFacts,
  type LinkProblemReportToDefectError,
  type ProblemReportLinkedToDefect,
} from "./link-problem-report-to-defect";
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
 * triaged when it is reported – a defect recorded, the problem report linked to an open defect, or the problem resolved
 * on the spot, which a helper may choose too. The decision of reporting runs
 * first, then the decision of the triage outcome's own command on the new problem report, so all rules of both apply,
 * and the command layer stores the problem report, its triage and a new defect together or not at all.
 */

/** The triage outcome chosen when reporting, with what its own command takes. */
export type TriageInTheSameStep =
  | ({ outcome: "defect-recorded" } & Omit<RecordDefectInput, "problemReportId" | "version">)
  | { outcome: "resolved-on-the-spot"; note: string }
  /** No defect chosen: undefined. */
  | { outcome: "linked"; defectId: string | undefined };

/**
 * What the decision must know beyond the new problem report: the machine as Collection knows it now, and – for the
 * outcome *linked* – the chosen defect as it is stored now (none for no or an unknown defect).
 */
export type ReportingAndTriageFacts = ReportingFacts & LinkingFacts;

export type ReportProblemAndTriageInput = ReportProblemInput & { triage?: TriageInTheSameStep };

/** A new problem report cannot have been triaged by someone else – every other rule of the outcome's command applies. */
export type ReportProblemAndTriageError =
  ReportProblemError | TriageRequired | "not-authorized" | Exclude<TriageError, "already-triaged">;

type TriageError = RecordDefectError | ResolveProblemOnTheSpotError | LinkProblemReportToDefectError;

/** A technician's problem report without a triage outcome – rejected by the command itself (user, 2026-10-10). */
export type TriageRequired = "triage-required";

type TriageEvent = DefectRecorded | ProblemResolvedOnTheSpot | ProblemReportLinkedToDefect;

export function reportProblemAndTriage(
  facts: ReportingAndTriageFacts,
  input: ReportProblemAndTriageInput,
  context: DecisionContext<ReportingPerson>,
): Decision<ProblemReport, ProblemReported | TriageEvent, ReportProblemAndTriageError> {
  const { actor } = context;
  const teamMember = actor.kind === "team-member" ? actor : undefined;
  const technician = teamMember?.role === "technician";
  // Who may choose which triage outcome is the rule of that outcome's own command: resolving on the spot is for every
  // team member, everything else for technicians only. A problem report with an outcome its reporter may not choose is
  // rejected as a whole, never stored without it (CMD-ReportProblem rules; user, 2026-10-11).
  if (input.triage && !(technician || (teamMember && input.triage.outcome === "resolved-on-the-spot"))) {
    return { ok: false, error: "not-authorized" };
  }
  const reported = reportProblem(facts, input, context);
  if (!reported.ok || !teamMember) return reported;
  // A technician's problem report is never stored untriaged, whatever form sent it; a helper's may be.
  if (!input.triage) return technician ? { ok: false, error: "triage-required" } : reported;
  const triaged = triage(reported.state, input.triage, { ...context, actor: teamMember }, facts);
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
  context: DecisionContext<ActorOf<"helper" | "technician">>,
  facts: ReportingAndTriageFacts,
): Decision<ProblemReport, TriageEvent, TriageError | "not-authorized"> {
  const target = { problemReportId: report.id, version: 0 };
  if (chosen.outcome === "resolved-on-the-spot") {
    return resolveProblemOnTheSpot(report, { ...target, note: chosen.note }, context);
  }
  const { actor } = context;
  if (actor.role !== "technician") return { ok: false, error: "not-authorized" };
  const asTechnician = { ...context, actor: { ...actor, role: actor.role } };
  if (chosen.outcome === "linked") {
    return linkProblemReportToDefect(report, { ...target, defectId: chosen.defectId }, asTechnician, facts);
  }
  const { title, priority, suitableForHelpers, machineStatus, machineVersion } = chosen;
  return recordDefect(
    report,
    { ...target, title, priority, suitableForHelpers, machineStatus, machineVersion },
    asTechnician,
    facts,
  );
}
