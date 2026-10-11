import type { ActorOf, Decision, DecisionContext, TeamMemberId } from "@/platform/command";
import type { Defect } from "./defect";

/**
 * CMD-ClaimDefect (AGG-Defect, ST-025): a team member claims an open defect, so others see who works on it – or takes
 * it over from its claimant, which everyone may. A claim is only a signal: others may still log work (HS-8).
 */

/** Who may claim a defect – every team member (helpers only defects suitable for helpers). */
export const claimingActors = ["helper", "technician"] as const;

type ClaimingPerson = ActorOf<(typeof claimingActors)[number]>;

export type ClaimDefectInput = {
  defectId: string;
  /** The version of the defect the team member saw (HS-16) – a concurrent claim is rejected, never a silent takeover. */
  version: number;
};

export type DefectClaimed = {
  type: "EVT-DefectClaimed";
  defectId: string;
  machineId: string;
  claimedBy: TeamMemberId;
  /** The claimant it was taken over from, if any. */
  takenOverFrom: TeamMemberId | undefined;
};

export type ClaimDefectError = "defect-not-open" | "not-suitable-for-helpers" | "already-claimed-by-you";

export function claimDefect(
  defect: Defect,
  _input: ClaimDefectInput,
  { actor, clock }: DecisionContext<ClaimingPerson>,
): Decision<Defect, DefectClaimed, ClaimDefectError> {
  // A resolved defect can only be reopened; one closed on retirement is final (AGG-Defect invariants).
  if (defect.state !== "open") return { ok: false, error: "defect-not-open" };
  if (actor.role === "helper" && !defect.suitableForHelpers) return { ok: false, error: "not-suitable-for-helpers" };
  // Claiming one's own claim again changes nothing – in particular not since when it is claimed (user, 2026-10-11).
  if (defect.claim?.claimedBy === actor.teamMemberId) return { ok: false, error: "already-claimed-by-you" };
  return {
    ok: true,
    state: { ...defect, claim: { claimedBy: actor.teamMemberId, claimedAt: clock.now() } },
    events: [
      {
        type: "EVT-DefectClaimed",
        defectId: defect.id,
        machineId: defect.machineId,
        claimedBy: actor.teamMemberId,
        takenOverFrom: defect.claim?.claimedBy,
      },
    ],
  };
}
