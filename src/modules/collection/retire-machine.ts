import type { ActorOf, Decision, DecisionContext, Role } from "@/platform/command";
import type { Machine } from "./register-machine";

/**
 * CMD-RetireMachine (AGG-Machine, ST-039): a technician retires a machine that leaves the museum, with a reason. A
 * retired machine is final; its history and its museum number stay (HS-17, HS-19). What Repair closes and dismisses
 * on retirement are its own policies, added to this command in Repair (ADR 0010).
 */

/** Who may retire a machine – the allowed actors of CMD-RetireMachine. */
export const retiringActors = ["technician"] as const;

type RetiringPerson = ActorOf<(typeof retiringActors)[number]>;

/** What the technician gave (ST-073, Q19): the reason as it was typed. */
export type RetireMachineInput = {
  machineId: string;
  /** The version of the machine the technician saw (HS-16). */
  version: number;
  reason: string;
};

export type MachineRetired = { type: "EVT-MachineRetired"; machineId: string };

export type RetireMachineError = "not-authorized" | "machine-retired" | "reason-required";

/** The retirement lock is held when the decision runs (ADR 0010) – nothing creates anything on the machine meanwhile. */
export type RetirementFacts = { lock: "held" };

/**
 * Why this team member may not retire the machine as it is, whatever reason they give – undefined when they may. The
 * machine record asks it to offer „Gerät ausmustern“ only where it will not be rejected (G11).
 */
export function retireRefusal(
  machine: { retired: boolean },
  teamMember: { role: Role },
): "not-authorized" | "machine-retired" | undefined {
  if (!retiringActors.some((actor) => actor === teamMember.role)) return "not-authorized";
  // A retired machine is final – it cannot be retired again (AGG-Machine).
  return machine.retired ? "machine-retired" : undefined;
}

/** The rule that needs only the typed reason – asked before the question is shown, so it never asks for nothing (G10b). */
export function retireReasonRefusal(reason: string): "reason-required" | undefined {
  return reason.trim() ? undefined : "reason-required";
}

export function retireMachine(
  machine: Machine,
  input: RetireMachineInput,
  { actor, clock }: DecisionContext<RetiringPerson>,
  facts: RetirementFacts,
): Decision<Machine, MachineRetired, RetireMachineError> {
  // Deciding without the lock would let a problem report slip past the retirement policies (ADR 0010).
  if (facts.lock !== "held") throw new Error("CMD-RetireMachine decides only while holding the retirement lock");
  const refusal = retireRefusal({ retired: machine.retirement !== undefined }, actor) ?? retireReasonRefusal(input.reason);
  if (refusal) return { ok: false, error: refusal };
  const reason = input.reason.trim();
  return {
    ok: true,
    state: { ...machine, retirement: { reason, retiredBy: actor.teamMemberId, retiredAt: clock.now() } },
    events: [{ type: "EVT-MachineRetired", machineId: machine.id }],
  };
}
