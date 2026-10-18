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
  changedBy: TeamMemberId;
};

/**
 * What the decision reads besides the defect: the role of its claimant as Team knows it now – none when it is not
 * claimed, or the claimant's account is no longer active.
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
  // Only defects suitable for helpers can be claimed by helpers: removing the mark releases a helper's claim in the
  // same step (rule on CMD-ChangeDefectDetails); a technician's claim stays.
  const released =
    !input.suitableForHelpers && defect.claim && facts.claimantRole === "helper" ? defect.claim : undefined;
  return {
    ok: true,
    state: {
      ...defect,
      title,
      suitableForHelpers: input.suitableForHelpers,
      claim: released ? undefined : defect.claim,
    },
    events: [
      {
        type: "EVT-DefectDetailsChanged",
        defectId: defect.id,
        machineId: defect.machineId,
        changed,
        title,
        suitableForHelpers: input.suitableForHelpers,
        changedBy: actor.teamMemberId,
      },
      ...(released
        ? [
            {
              type: "EVT-DefectClaimReleased" as const,
              defectId: defect.id,
              machineId: defect.machineId,
              formerClaimant: released.claimedBy,
              releasedBy: actor.teamMemberId,
            },
          ]
        : []),
    ],
  };
}
