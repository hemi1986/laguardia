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
export type ReportProblemAndTriageError = ReportProblemError | Exclude<RecordDefectError, "already-triaged">;

export function reportProblemAndTriage(
  facts: ReportingFacts,
  input: ReportProblemAndTriageInput,
  context: DecisionContext<ReportingPerson>,
): Decision<ProblemReport, ProblemReported | DefectRecorded, ReportProblemAndTriageError> {
  const reported = reportProblem(facts, input, context);
  const { actor } = context;
  if (!reported.ok || !input.triage || actor.kind !== "team-member" || actor.role !== "technician") return reported;
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
