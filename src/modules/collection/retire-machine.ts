import type { ActorOf, Decision, DecisionContext } from "@/platform/command";
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

export type RetireMachineError = "machine-retired" | "reason-required";

/** The retirement lock is held when the decision runs (ADR 0010) – nothing creates anything on the machine meanwhile. */
export type RetirementFacts = { lock: "held" };

export function retireMachine(
  machine: Machine,
  input: RetireMachineInput,
  { actor, clock }: DecisionContext<RetiringPerson>,
  _facts: RetirementFacts,
): Decision<Machine, MachineRetired, RetireMachineError> {
  // A retired machine is final – it cannot be retired again (AGG-Machine).
  if (machine.retirement) return { ok: false, error: "machine-retired" };
  const reason = input.reason.trim();
  if (!reason) return { ok: false, error: "reason-required" };
  return {
    ok: true,
    state: { ...machine, retirement: { reason, retiredBy: actor.teamMemberId, retiredAt: clock.now() } },
    events: [{ type: "EVT-MachineRetired", machineId: machine.id }],
  };
}
