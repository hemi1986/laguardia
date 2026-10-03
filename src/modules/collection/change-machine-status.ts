import type { ActorOf, Decision, DecisionContext } from "@/platform/command";
import type { Machine, MachineStatus } from "./register-machine";

/**
 * CMD-ChangeMachineStatus (AGG-Machine, ST-012): a team member changes a machine's status with a reason; the change
 * is kept in the status history (previous status, new status, reason, who, when).
 */

/** Who may change a machine status – the allowed actors of CMD-ChangeMachineStatus. */
export const changingActors = ["helper", "technician"] as const;

type ChangingPerson = ActorOf<(typeof changingActors)[number]>;

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

export type ChangeMachineStatusError = "helpers-only-out-of-order";

export function changeMachineStatus(
  machine: Machine,
  input: ChangeMachineStatusInput,
  { actor, clock, newId }: DecisionContext<ChangingPerson>,
): Decision<Machine, MachineStatusChanged, ChangeMachineStatusError> {
  const newStatus = input.machineStatus!;
  // Whether the machine is really unsafe is a matter of trust; the required reason documents it (ST-012).
  if (actor.role === "helper" && newStatus !== "out-of-order") return { ok: false, error: "helpers-only-out-of-order" };
  const reason = input.reason.trim();
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
