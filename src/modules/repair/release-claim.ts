import type { ActorOf, Decision, DecisionContext, TeamMemberId } from "@/platform/command";
import type { Defect } from "./defect";

/**
 * CMD-ReleaseClaim (AGG-Defect, ST-026): a claim ends without the defect being resolved – released by its claimant, or
 * by a technician for someone else. The defect is unclaimed afterwards and stays open. Stale claims are only
 * highlighted (ST-058), never released automatically.
 */

/** Who may release a claim – every team member their own, technicians any. */
export const releasingActors = ["helper", "technician"] as const;

type ReleasingPerson = ActorOf<(typeof releasingActors)[number]>;

export type ReleaseClaimInput = {
  defectId: string;
  /** The version of the defect the team member saw (HS-16) – a claim someone took over meanwhile is not released. */
  version: number;
};

export type DefectClaimReleased = {
  type: "EVT-DefectClaimReleased";
  defectId: string;
  machineId: string;
  releasedBy: TeamMemberId;
};

export type ReleaseClaimError = "not-claimed" | "not-your-claim";

/**
 * Why this team member may not release the defect's claim as it is – undefined when they may. The one rule of
 * CMD-ReleaseClaim: the decision applies it, and a page asks it to offer the control only to someone it will not
 * reject (G11). A defect that is not open has no claim: resolving ends it (AGG-Defect invariants).
 */
export function releaseRefusal(
  defect: Pick<Defect, "claim">,
  actor: Pick<ReleasingPerson, "teamMemberId" | "role">,
): ReleaseClaimError | undefined {
  if (!defect.claim) return "not-claimed";
  if (actor.role !== "technician" && defect.claim.claimedBy !== actor.teamMemberId) return "not-your-claim";
  return undefined;
}

export function releaseClaim(
  defect: Defect,
  _input: ReleaseClaimInput,
  { actor }: DecisionContext<ReleasingPerson>,
): Decision<Defect, DefectClaimReleased, ReleaseClaimError> {
  const refusal = releaseRefusal(defect, actor);
  if (refusal) return { ok: false, error: refusal };
  return {
    ok: true,
    state: { ...defect, claim: undefined },
    events: [
      {
        type: "EVT-DefectClaimReleased",
        defectId: defect.id,
        machineId: defect.machineId,
        releasedBy: actor.teamMemberId,
      },
    ],
  };
}
