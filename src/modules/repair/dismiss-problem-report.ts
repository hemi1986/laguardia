import type { ActorOf, Decision, DecisionContext } from "@/platform/command";
import type { DismissalReason, ProblemReport } from "./report-problem";

/**
 * CMD-DismissProblemReport (AGG-ProblemReport, ST-020): a technician dismisses a problem report that describes no
 * fault, is spam, or is set aside for another reason given as free text. Dismissing as spam removes the description
 * and the photo – the event names the removed photo, so it can be deleted from the storage after the commit (ADR 0007).
 */

/** Who may dismiss a problem report by hand – technicians only; the system follows with ST-039. */
export const dismissingActors = ["technician"] as const;

type DismissingPerson = ActorOf<(typeof dismissingActors)[number]>;

/** The reasons a person may choose (ST-020); *machine retired* is set only by POL-RetirementDismissesProblemReports. */
export const reasonsByHand = ["not-a-fault", "spam", "other"] as const satisfies readonly DismissalReason[];

export type DismissProblemReportInput = {
  problemReportId: string;
  /** The version of the problem report the technician saw (HS-16). */
  version: number;
  /** No reason given: undefined. */
  reason: DismissalReason | undefined;
  /** The free text – required for the reason *other*, ignored for the others. */
  reasonText: string;
};

export type ProblemReportDismissed = {
  type: "EVT-ProblemReportDismissed";
  problemReportId: string;
  machineId: string;
  reason: DismissalReason;
  reasonText: string | undefined;
  /** The stored photo a spam dismissal removed from the problem report – to be deleted from the storage. */
  removedPhoto: string | undefined;
};

export type DismissProblemReportError = "already-triaged" | "dismissal-reason-required" | "dismissal-reason-text-required";

export function dismissProblemReport(
  report: ProblemReport,
  input: DismissProblemReportInput,
  { actor, clock }: DecisionContext<DismissingPerson>,
): Decision<ProblemReport, ProblemReportDismissed, DismissProblemReportError> {
  if (report.triage) return { ok: false, error: "already-triaged" };
  const reason = reasonsByHand.find((byHand) => byHand === input.reason);
  if (!reason) return { ok: false, error: "dismissal-reason-required" };
  const text = reason === "other" ? input.reasonText.trim() : undefined;
  if (text === "") return { ok: false, error: "dismissal-reason-text-required" };

  const spam = reason === "spam";
  const { photo, ...withoutPhoto } = report;
  return {
    ok: true,
    state: {
      ...(spam ? { ...withoutPhoto, description: undefined } : report),
      triage: {
        outcome: "dismissed",
        triagedBy: actor.teamMemberId,
        triagedAt: clock.now(),
        dismissal: text === undefined ? { reason } : { reason, text },
      },
    },
    events: [
      {
        type: "EVT-ProblemReportDismissed",
        problemReportId: report.id,
        machineId: report.machineId,
        reason,
        reasonText: text,
        removedPhoto: spam ? photo : undefined,
      },
    ],
  };
}
