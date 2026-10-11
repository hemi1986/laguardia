import type { Decision, DecisionContext } from "@/platform/command";
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

/**
 * CMD-ReportProblem with its triage outcome in the same step (ST-023): a technician's own problem report is triaged
 * when it is reported – here with the outcome *defect recorded*. The decision of reporting runs first, then the
 * decision of the triage outcome's own command on the new problem report, so all rules of both apply, and the command
 * layer stores the problem report, its triage and the new defect together or not at all.
 */

/** The triage outcome chosen when reporting: *record a defect*, with what CMD-RecordDefect takes. */
export type TriageInTheSameStep = { outcome: "defect-recorded" } & Omit<
  RecordDefectInput,
  "problemReportId" | "version"
>;

export type ReportProblemAndTriageInput = ReportProblemInput & { triage?: TriageInTheSameStep };

/** A new problem report cannot have been triaged by someone else – every other rule of CMD-RecordDefect applies. */
export type ReportProblemAndTriageError =
  ReportProblemError | TriageRequired | "not-authorized" | Exclude<RecordDefectError, "already-triaged">;

/** A technician's problem report without a triage outcome – rejected by the command itself (user, 2026-10-10). */
export type TriageRequired = "triage-required";

export function reportProblemAndTriage(
  facts: ReportingFacts,
  input: ReportProblemAndTriageInput,
  context: DecisionContext<ReportingPerson>,
): Decision<ProblemReport, ProblemReported | DefectRecorded, ReportProblemAndTriageError> {
  const { actor } = context;
  const technician = actor.kind === "team-member" && actor.role === "technician";
  // Recording a defect is for technicians only (CMD-RecordDefect) – a helper's or visitor's problem report with that
  // triage outcome is rejected as a whole, never stored without it (CMD-ReportProblem rules; user, 2026-10-11).
  if (input.triage && !technician) return { ok: false, error: "not-authorized" };
  const reported = reportProblem(facts, input, context);
  if (!reported.ok || actor.kind !== "team-member" || actor.role !== "technician") return reported;
  // A technician's problem report is never stored untriaged, whatever form sent it (CMD-ReportProblem rules).
  if (!input.triage) return { ok: false, error: "triage-required" };
  const { title, priority, suitableForHelpers, machineStatus, machineVersion } = input.triage;
  const triaged = recordDefect(
    reported.state,
    {
      problemReportId: reported.state.id,
      version: 0,
      title,
      priority,
      suitableForHelpers,
      machineStatus,
      machineVersion,
    },
    { ...context, actor: { ...actor, role: actor.role } },
    facts,
  );
  if (!triaged.ok) {
    if (triaged.error === "already-triaged") throw new Error("CMD-ReportProblem: a new problem report is untriaged");
    return { ok: false, error: triaged.error };
  }
  return { ...triaged, events: [...reported.events, ...triaged.events] };
}
