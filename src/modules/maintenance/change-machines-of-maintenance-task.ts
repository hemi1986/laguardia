import type { ActorOf, Decision, DecisionContext, TeamMemberId } from "@/platform/command";
import {
  machinesRefusal,
  type ChangeMaintenancePlanError,
  type MachinesOfMaintenanceTaskChanged,
} from "./change-maintenance-plan";
import type { ChosenMachines } from "./chosen-machines";
import type { MaintenancePlan } from "./maintenance-plan";

/**
 * CMD-ChangeMachinesOfMaintenanceTask (AGG-MaintenancePlan, ST-095): a technician adds machines to a maintenance task and
 * removes machines from it later. The command carries what the technician *changed*, not the whole list: the machines as
 * they were ticked when the page opened (`seen`) and the machines ticked now. The machines newly ticked are added, the
 * machines unticked are removed; every other machine stays as it is *now*, whatever another technician did meanwhile.
 */

/** Who may change the machines of a maintenance task – technicians only. */
export const changeMachinesActors = ["technician"] as const;

type ChangingPerson = ActorOf<(typeof changeMachinesActors)[number]>;

/**
 * The machines exactly as posted: a forged change may name one La Guardia does not know, or one twice. `seen` and
 * `ticked` hold only what the page offered – a retired machine is in neither, so it stays among the machines.
 */
export type ChangeMachinesOfMaintenanceTaskInput = {
  maintenanceTaskId: string;
  seen: readonly string[];
  ticked: readonly string[];
};

export type ChangeMachinesOfMaintenanceTaskError =
  | "maintenance-task-unknown"
  | Extract<ChangeMaintenancePlanError, "unknown-machine" | "machine-retired" | "machine-chosen-twice">;

/** The machines ticked now that were not ticked when the page opened – the ones the technician wants added. */
export function machinesTickedNewly(input: Pick<ChangeMachinesOfMaintenanceTaskInput, "seen" | "ticked">): string[] {
  const seen = new Set(input.seen);
  return input.ticked.filter((machineId) => !seen.has(machineId));
}

/** The machines the change touches – newly ticked or unticked – which the command reads from Collection. */
export function machinesTouched(input: Pick<ChangeMachinesOfMaintenanceTaskInput, "seen" | "ticked">): string[] {
  const ticked = new Set(input.ticked);
  return [...new Set([...machinesTickedNewly(input), ...input.seen.filter((machineId) => !ticked.has(machineId))])];
}

/**
 * The plan after machines were added to and removed from one maintenance task (the machines of a task, ST-095): a machine
 * removed is marked, never deleted; one added again after a removal starts its entry anew, so only records recorded from
 * now on count (HS-24). Shared by the change from the task (ST-095) and from the machine record (ST-096).
 */
export function withMachinesChanged(
  plan: MaintenancePlan,
  maintenanceTaskId: string,
  { added, removed }: { added: readonly string[]; removed: readonly string[] },
  { now, newId }: { now: Date; newId: () => string },
): MaintenancePlan {
  const entries = plan.machinesOfTasks.filter((each) => each.maintenanceTaskId === maintenanceTaskId);
  const addedMachines = added.map((machineId) => {
    const earlier = entries.find((each) => each.machineId === machineId);
    return earlier
      ? { ...earlier, addedAt: now, removedAt: undefined }
      : { id: newId(), maintenanceTaskId, machineId, addedAt: now, removedAt: undefined };
  });
  const removedMachines = entries
    .filter((each) => !each.removedAt && removed.includes(each.machineId))
    .map((each) => ({ ...each, removedAt: now }));
  const changedEntries = new Map([...addedMachines, ...removedMachines].map((each) => [each.id, each]));
  const known = new Set(plan.machinesOfTasks.map((each) => each.id));
  return {
    ...plan,
    machinesOfTasks: [
      ...plan.machinesOfTasks.map((each) => changedEntries.get(each.id) ?? each),
      ...addedMachines.filter((each) => !known.has(each.id)),
    ],
  };
}

export function changeMachinesOfMaintenanceTask(
  plan: MaintenancePlan,
  input: ChangeMachinesOfMaintenanceTaskInput,
  { actor, clock, newId }: DecisionContext<ChangingPerson>,
  chosen: ChosenMachines,
): Decision<MaintenancePlan, MachinesOfMaintenanceTaskChanged, ChangeMachinesOfMaintenanceTaskError> {
  // A removed maintenance task is final: its machines never change again (invariant).
  const task = plan.maintenanceTasks.find((each) => each.id === input.maintenanceTaskId && !each.removedAt);
  if (!task) return { ok: false, error: "maintenance-task-unknown" };
  const ticked = new Set(input.ticked);
  const entries = plan.machinesOfTasks.filter((each) => each.maintenanceTaskId === task.id);
  const among = new Set(entries.filter((each) => !each.removedAt).map((each) => each.machineId));
  // Adding one that is already among the machines, or removing one that no longer is, changes nothing.
  const added = [...new Set(machinesTickedNewly(input))].filter((machineId) => !among.has(machineId));
  // The whole change is rejected, or none of it is stored – a machine already among the machines needs no check.
  const refusal = machinesRefusal(input.ticked, chosen, added);
  if (refusal) return { ok: false, error: refusal };
  // A machine retired meanwhile stays among the machines even when the form still names it as seen: not being offered
  // is not unticking it.
  const removed = [...new Set(input.seen)].filter(
    (machineId) => !ticked.has(machineId) && among.has(machineId) && !chosen.get(machineId)?.retired,
  );
  if (added.length === 0 && removed.length === 0) return { ok: true, state: plan, events: [] };

  return {
    ok: true,
    state: withMachinesChanged(plan, task.id, { added, removed }, { now: clock.now(), newId }),
    events: [
      {
        type: "EVT-MachinesOfMaintenanceTaskChanged",
        maintenanceTaskId: task.id,
        machinesAdded: added,
        machinesRemoved: removed,
        changedBy: (actor satisfies { teamMemberId: TeamMemberId }).teamMemberId,
      },
    ],
  };
}
