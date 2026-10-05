import type { ActorOf, Decision, DecisionContext } from "@/platform/command";
import type { ProblemReport } from "./report-problem";

/**
 * CMD-ResolveProblemOnTheSpot (AGG-ProblemReport, ST-019): a team member fixed the problem immediately (a stuck ball
 * freed) – the problem report is triaged with the outcome *resolved on the spot* and a note, no defect is created. It
 * stays in the machine's repair history (ST-033).
 */

/** Who may resolve a problem on the spot – helpers too (CONTEXT.md: Resolved on the spot). */
export const resolvingActors = ["helper", "technician"] as const;

type ResolvingPerson = ActorOf<(typeof resolvingActors)[number]>;

export type ResolveProblemOnTheSpotInput = {
  problemReportId: string;
  /** The version of the problem report the team member saw (HS-16). */
  version: number;
  note: string;
};

export type ProblemResolvedOnTheSpot = {
  type: "EVT-ProblemResolvedOnTheSpot";
  problemReportId: string;
  machineId: string;
  note: string;
};

export type ResolveProblemOnTheSpotError = "already-triaged" | "note-required";

export function resolveProblemOnTheSpot(
  report: ProblemReport,
  input: ResolveProblemOnTheSpotInput,
  { actor, clock }: DecisionContext<ResolvingPerson>,
): Decision<ProblemReport, ProblemResolvedOnTheSpot, ResolveProblemOnTheSpotError> {
  if (report.triage) return { ok: false, error: "already-triaged" };
  const note = input.note.trim();
  if (!note) return { ok: false, error: "note-required" };
  return {
    ok: true,
    state: {
      ...report,
      triage: { outcome: "resolved-on-the-spot", triagedBy: actor.teamMemberId, triagedAt: clock.now(), note },
    },
    events: [{ type: "EVT-ProblemResolvedOnTheSpot", problemReportId: report.id, machineId: report.machineId, note }],
  };
}
