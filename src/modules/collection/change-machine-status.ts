import type { ActorOf, Decision, DecisionContext, Role } from "@/platform/command";
import { machineStatuses, type Machine, type MachineStatus } from "./register-machine";

/**
 * CMD-ChangeMachineStatus (AGG-Machine, ST-012): a team member changes a machine's status with a reason; the change
 * is kept in the status history (previous status, new status, reason, who, when).
 */

/** Who may change a machine status – the allowed actors of CMD-ChangeMachineStatus. */
export const changingActors = ["helper", "technician"] as const;

type ChangingPerson = ActorOf<(typeof changingActors)[number]>;

/**
 * The machine statuses a team member may set: technicians any, helpers only Out of order (AGG-Machine). That a
 * helper does so only when the machine is unsafe is a matter of trust; the required reason documents it.
 */
export function machineStatusesSettableBy(role: Role): readonly MachineStatus[] {
  return role === "technician" ? machineStatuses : ["out-of-order"];
}

/** What the acting person gave (ST-073, Q19): a missing machine status is "no value given"; the reason as typed. */
export type ChangeMachineStatusInput = {
  machineId: string;
  /** The version of the machine the acting person saw (HS-16). */
  version: number;
  machineStatus: MachineStatus | undefined;
  reason: string;
};

export type MachineStatusChanged = {
  type: "EVT-MachineStatusChanged";
  machineId: string;
  previousStatus: MachineStatus;
  newStatus: MachineStatus;
};

export type ChangeMachineStatusError =
  | "machine-retired"
  | "machine-status-required"
  | "helpers-only-out-of-order"
  | "machine-status-unchanged"
  | "reason-required";

export function changeMachineStatus(
  machine: Machine,
  input: ChangeMachineStatusInput,
  { actor, clock, newId }: DecisionContext<ChangingPerson>,
): Decision<Machine, MachineStatusChanged, ChangeMachineStatusError> {
  // A retired machine is final (AGG-Machine).
  if (machine.retirement) return { ok: false, error: "machine-retired" };
  const newStatus = input.machineStatus;
  if (!newStatus) return { ok: false, error: "machine-status-required" };
  if (!machineStatusesSettableBy(actor.role).includes(newStatus)) return { ok: false, error: "helpers-only-out-of-order" };
  // No history entry without a change (user, 2026-10-03).
  if (newStatus === machine.machineStatus) return { ok: false, error: "machine-status-unchanged" };
  const reason = input.reason.trim();
  if (!reason) return { ok: false, error: "reason-required" };
  const previousStatus = machine.machineStatus;
  return {
    ok: true,
    state: {
      ...machine,
      machineStatus: newStatus,
      statusHistory: [
        ...machine.statusHistory,
        { id: newId(), previousStatus, newStatus, reason, changedBy: actor.teamMemberId, changedAt: clock.now() },
      ],
    },
    events: [{ type: "EVT-MachineStatusChanged", machineId: machine.id, previousStatus, newStatus }],
  };
}
