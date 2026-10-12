import type { ActorOf, Decision, DecisionContext, Role, TeamMemberId } from "@/platform/command";
import type { Defect } from "./defect";

/**
 * CMD-ClaimDefect (AGG-Defect, ST-025): a team member claims an open defect, so others see who works on it – or takes
 * it over from its claimant, which everyone may. A technician may also assign it to another team member, who becomes
 * its claimant (ST-026). A claim is only a signal: others may still log work (HS-8).
 */

/** Who may claim a defect – every team member (helpers only defects suitable for helpers). */
export const claimingActors = ["helper", "technician"] as const;

type ClaimingPerson = ActorOf<(typeof claimingActors)[number]>;

export type ClaimDefectInput = {
  defectId: string;
  /** The version of the defect the team member saw (HS-16) – a concurrent claim is rejected, never a silent takeover. */
  version: number;
  /**
   * The team member a technician assigns the defect to (ST-026) – left out when the acting team member claims it
   * themselves. An empty value is an assignment to nobody, which is rejected: it never turns into a claim of one's own.
   */
  assignTo?: string;
};

/** What CMD-ClaimDefect knows from Team when a defect is assigned: the role of the team member it is assigned to. */
export type ClaimingFacts = {
  /** Undefined when nobody is assigned, or when that team member has no active account. */
  assignee: { role: Role } | undefined;
};

export type DefectClaimed = {
  type: "EVT-DefectClaimed";
  defectId: string;
  machineId: string;
  claimedBy: TeamMemberId;
  /** The claimant it was taken over from, if any. */
  takenOverFrom: TeamMemberId | undefined;
  /** The technician who assigned it, when the claimant did not claim it themselves (ST-026). */
  assignedBy: TeamMemberId | undefined;
};

export type ClaimDefectError =
  | "defect-not-open"
  | "not-suitable-for-helpers"
  | "already-claimed-by-you"
  | "not-authorized"
  | "team-member-required"
  | "team-member-not-active"
  | "already-claimed-by-them";

/**
 * Why this team member may not claim the defect as it is – undefined when they may. The one rule of CMD-ClaimDefect:
 * the decision applies it, and a page asks it to offer the control only to someone it will not reject (G11).
 */
export function claimRefusal(
  defect: Pick<Defect, "state" | "suitableForHelpers" | "claim">,
  actor: Pick<ClaimingPerson, "teamMemberId" | "role">,
): "defect-not-open" | "not-suitable-for-helpers" | "already-claimed-by-you" | undefined {
  // A resolved defect can only be reopened; one closed on retirement is final (AGG-Defect invariants).
  if (defect.state !== "open") return "defect-not-open";
  if (actor.role === "helper" && !defect.suitableForHelpers) return "not-suitable-for-helpers";
  // Claiming one's own claim again changes nothing – in particular not since when it is claimed (user, 2026-10-11).
  if (defect.claim?.claimedBy === actor.teamMemberId) return "already-claimed-by-you";
  return undefined;
}

/**
 * Why this team member may not assign the defect to anyone – undefined when they may (ST-026): only technicians
 * assign, and only an open defect. Whom it can be assigned to is `assigneeRefusal`.
 */
export function assignRefusal(
  defect: Pick<Defect, "state">,
  actor: Pick<ClaimingPerson, "role">,
): "not-authorized" | "defect-not-open" | undefined {
  if (actor.role !== "technician") return "not-authorized";
  if (defect.state !== "open") return "defect-not-open";
  return undefined;
}

/**
 * Why the defect cannot be assigned to this team member – undefined when it can (ST-026). A page asks it for every
 * team member it offers as a choice (G11); `assignee` is undefined for someone without an active account.
 */
export function assigneeRefusal(
  defect: Pick<Defect, "suitableForHelpers" | "claim">,
  assignee: { teamMemberId: TeamMemberId; role: Role } | undefined,
): "team-member-not-active" | "not-suitable-for-helpers" | "already-claimed-by-them" | undefined {
  if (!assignee) return "team-member-not-active";
  if (assignee.role === "helper" && !defect.suitableForHelpers) return "not-suitable-for-helpers";
  if (defect.claim?.claimedBy === assignee.teamMemberId) return "already-claimed-by-them";
  return undefined;
}

export function claimDefect(
  defect: Defect,
  input: ClaimDefectInput,
  { actor, clock }: DecisionContext<ClaimingPerson>,
  facts: ClaimingFacts,
): Decision<Defect, DefectClaimed, ClaimDefectError> {
  // Assigning a defect to oneself is claiming it.
  const assigning = input.assignTo !== undefined && input.assignTo !== actor.teamMemberId;
  if (assigning) {
    const refusal =
      assignRefusal(defect, actor) ??
      (input.assignTo
        ? assigneeRefusal(defect, facts.assignee && { teamMemberId: input.assignTo, role: facts.assignee.role })
        : "team-member-required");
    if (refusal) return { ok: false, error: refusal };
  } else {
    const refusal = claimRefusal(defect, actor);
    if (refusal) return { ok: false, error: refusal };
  }
  const claimedBy = assigning && input.assignTo ? input.assignTo : actor.teamMemberId;
  const assignedBy = assigning ? actor.teamMemberId : undefined;
  return {
    ok: true,
    state: { ...defect, claim: { claimedBy, claimedAt: clock.now(), ...(assignedBy ? { assignedBy } : {}) } },
    events: [
      {
        type: "EVT-DefectClaimed",
        defectId: defect.id,
        machineId: defect.machineId,
        claimedBy,
        takenOverFrom: defect.claim?.claimedBy,
        assignedBy,
      },
    ],
  };
}
