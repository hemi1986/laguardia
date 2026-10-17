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
  /** Whose claim ended – kept in the journal only, since the claim is gone (ST-086). */
  formerClaimant: TeamMemberId;
  releasedBy: TeamMemberId;
};

export type ReleaseClaimError = "defect-not-open" | "not-claimed" | "not-your-claim";

/**
 * Why this team member may not release the defect's claim as it is – undefined when they may. The one rule of
 * CMD-ReleaseClaim: the decision applies it, and a page asks it to offer the control only to someone it will not
 * reject (G11). Only an open defect: a resolved one can only be reopened, one closed on retirement is final
 * (AGG-Defect invariants) – whatever became of its claim.
 */
export function releaseRefusal(
  defect: Pick<Defect, "state" | "claim">,
  actor: Pick<ReleasingPerson, "teamMemberId" | "role">,
): ReleaseClaimError | undefined {
  if (defect.state !== "open") return "defect-not-open";
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
  if (refusal || !defect.claim) return { ok: false, error: refusal ?? "not-claimed" };
  return {
    ok: true,
    state: { ...defect, claim: undefined },
    events: [
      {
        type: "EVT-DefectClaimReleased",
        defectId: defect.id,
        machineId: defect.machineId,
        formerClaimant: defect.claim.claimedBy,
        releasedBy: actor.teamMemberId,
      },
    ],
  };
}
