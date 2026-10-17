import type { ActorOf, Decision, DecisionContext, TeamMemberId } from "@/platform/command";
import { holdReasons, type Defect, type HoldReason } from "./defect";

/**
 * CMD-PutDefectOnHold (AGG-Defect, ST-029): an open defect cannot progress for now – waiting for a part, for a
 * technician, or another reason. It stays open and claimed; logging work does not end the hold, resolving does.
 */

/** Who may put a defect on hold – technicians any, a helper the defect they claimed. */
export const holdingActors = ["helper", "technician"] as const;

type HoldingPerson = ActorOf<(typeof holdingActors)[number]>;

export type PutDefectOnHoldInput = {
  defectId: string;
  /** The version of the defect the team member saw (HS-16). */
  version: number;
  /** Undefined when none was chosen – never a default (G20). */
  reason: HoldReason | undefined;
  note?: string;
};

export type DefectPutOnHold = {
  type: "EVT-DefectPutOnHold";
  defectId: string;
  machineId: string;
  reason: HoldReason;
  /** Typed text: in the aggregate, never in the journal (ST-003). */
  note: string | undefined;
};

export type PutDefectOnHoldError = "defect-not-open" | "defect-on-hold" | "not-claimant" | "hold-reason-required";

/**
 * Whether this team member may change the hold of the defect – technicians always, anyone else only as its claimant
 * (CMD-PutDefectOnHold, CMD-ResumeDefect). Shared by both decisions.
 */
export function mayChangeHold(defect: Pick<Defect, "claim">, actor: { teamMemberId: TeamMemberId; role: string }) {
  return actor.role === "technician" || defect.claim?.claimedBy === actor.teamMemberId;
}

/**
 * Why this team member may not put the defect on hold as it is, whatever reason they choose – undefined when they may.
 * The decision applies it, and a page asks it to offer the control only to someone it will not reject (G11).
 */
export function putOnHoldRefusal(
  defect: Pick<Defect, "state" | "hold" | "claim">,
  actor: Pick<HoldingPerson, "teamMemberId" | "role">,
): Exclude<PutDefectOnHoldError, "hold-reason-required"> | undefined {
  if (defect.state !== "open") return "defect-not-open";
  if (defect.hold) return "defect-on-hold";
  if (!mayChangeHold(defect, actor)) return "not-claimant";
  return undefined;
}

export function putDefectOnHold(
  defect: Defect,
  input: PutDefectOnHoldInput,
  { actor, clock }: DecisionContext<HoldingPerson>,
): Decision<Defect, DefectPutOnHold, PutDefectOnHoldError> {
  const refusal = putOnHoldRefusal(defect, actor);
  if (refusal) return { ok: false, error: refusal };
  if (!input.reason || !holdReasons.includes(input.reason)) return { ok: false, error: "hold-reason-required" };
  const note = input.note?.trim() || undefined;
  return {
    ok: true,
    state: { ...defect, hold: { reason: input.reason, note, heldAt: clock.now() } },
    events: [
      { type: "EVT-DefectPutOnHold", defectId: defect.id, machineId: defect.machineId, reason: input.reason, note },
    ],
  };
}
