import type { ActorOf, Decision, DecisionContext, Role, TeamMemberId } from "@/platform/command";
import type { Defect } from "./defect";
import type { DefectClaimReleased } from "./release-claim";

/**
 * CMD-ChangeDefectDetails (AGG-Defect, ST-031): a technician changes the title or the suitable-for-helpers mark of an
 * open defect, so that visitors see an understandable title and helpers get the defects they can handle once more is
 * known (HS-18).
 */

/** Who may change a defect's details – technicians only (HS-18). */
export const changingDetailsActors = ["technician"] as const;

type ChangingDetailsPerson = ActorOf<(typeof changingDetailsActors)[number]>;

export type ChangeDefectDetailsInput = {
  defectId: string;
  /** The version of the defect the technician saw (HS-16). */
  version: number;
  title: string;
  suitableForHelpers: boolean;
};

/** The details of a defect a technician can change. */
export type DefectDetail = "title" | "suitable-for-helpers";

export type DefectDetailsChanged = {
  type: "EVT-DefectDetailsChanged";
  defectId: string;
  machineId: string;
  /** Which details changed – so the journal can say so without repeating the title (story review 2026-10-17). */
  changed: DefectDetail[];
  /** Typed text: in the aggregate, never in the journal (ST-003). */
  title: string;
  suitableForHelpers: boolean;
  /** Whose claim removing the mark released in the same step, if anyone's – what the confirmation names (ST-031). */
  releasedClaimOf: TeamMemberId | undefined;
  changedBy: TeamMemberId;
};

/**
 * What the decision reads besides the defect: the role of its claimant as Team knows it now, whether or not their
 * account is still active – none when it is not claimed.
 */
export type ChangingDetailsFacts = { claimantRole: Role | undefined };

export type ChangeDefectDetailsError = "defect-not-open" | "title-required" | "details-unchanged";

/**
 * Why this team member may not change the defect's details as it is, whatever they enter – undefined when they may.
 * The decision applies it, and a page asks it to offer the control only to someone it will not reject (G11). Only
 * technicians: the command layer refuses anyone else before the decision runs, this says so to a page. Only an open
 * defect: a resolved one can only be reopened, one closed on retirement is final (AGG-Defect invariants).
 */
export function changeDetailsRefusal(
  defect: Pick<Defect, "state">,
  teamMember: { role: Role },
): "not-authorized" | "defect-not-open" | undefined {
  if (teamMember.role !== "technician") return "not-authorized";
  if (defect.state !== "open") return "defect-not-open";
  return undefined;
}

/**
 * Whose claim removing the suitable-for-helpers mark releases – a helper's, in the same step (rule on
 * CMD-ChangeDefectDetails); none for a technician's claim, or when nobody holds one. The decision applies it, and the
 * form page asks it to say so beside the mark (ST-031). `claimantRole` is the claimant's role as Team knows it now.
 */
export function claimReleasedByRemovingTheMark(
  defect: Pick<Defect, "claim">,
  claimantRole: Role | undefined,
): TeamMemberId | undefined {
  return defect.claim && claimantRole === "helper" ? defect.claim.claimedBy : undefined;
}

export function changeDefectDetails(
  defect: Defect,
  input: ChangeDefectDetailsInput,
  { actor }: DecisionContext<ChangingDetailsPerson>,
  facts: ChangingDetailsFacts,
): Decision<Defect, DefectDetailsChanged | DefectClaimReleased, ChangeDefectDetailsError | "not-authorized"> {
  const refusal = changeDetailsRefusal(defect, actor);
  if (refusal) return { ok: false, error: refusal };
  const title = input.title.trim();
  if (!title) return { ok: false, error: "title-required" };
  const changed: DefectDetail[] = [
    ...(title !== defect.title ? (["title"] as const) : []),
    ...(input.suitableForHelpers !== defect.suitableForHelpers ? (["suitable-for-helpers"] as const) : []),
  ];
  // A change that changes nothing would record no fact (user, 2026-10-18, as CMD-PrioritizeDefect).
  if (changed.length === 0) return { ok: false, error: "details-unchanged" };
  // Only defects suitable for helpers can be claimed by helpers.
  const released = input.suitableForHelpers ? undefined : claimReleasedByRemovingTheMark(defect, facts.claimantRole);
  return {
    ok: true,
    state: {
      ...defect,
      title,
      suitableForHelpers: input.suitableForHelpers,
      claim: released ? undefined : defect.claim,
    },
    // The release first: the change is the step's last fact, the one its confirmation reads (ST-031).
    events: [
      ...(released
        ? [
            {
              type: "EVT-DefectClaimReleased" as const,
              defectId: defect.id,
              machineId: defect.machineId,
              formerClaimant: released,
              releasedBy: actor.teamMemberId,
            },
          ]
        : []),
      {
        type: "EVT-DefectDetailsChanged",
        defectId: defect.id,
        machineId: defect.machineId,
        changed,
        title,
        suitableForHelpers: input.suitableForHelpers,
        releasedClaimOf: released,
        changedBy: actor.teamMemberId,
      },
    ],
  };
}
