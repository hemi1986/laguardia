import type { ActorOf, Decision, DecisionContext, TeamMemberId } from "@/platform/command";
import { withMachinesChanged, changeMachinesActors } from "./change-machines-of-maintenance-task";
import type { MachinesOfMaintenanceTaskChanged } from "./change-maintenance-plan";
import type { ChosenMachines } from "./chosen-machines";
import type { MaintenancePlan } from "./maintenance-plan";

/**
 * CMD-ChangeMachinesOfMaintenanceTask from the machine record (AGG-MaintenancePlan, ST-096): a technician chooses which
 * maintenance tasks apply to one machine – one machine, several tasks, one `EVT-MachinesOfMaintenanceTaskChanged` per task
 * that changed. As from a task (ST-095) the command carries what the technician *changed*: the tasks as they were ticked
 * when the page opened (`seen`) and the tasks ticked now. A task newly ticked is added to, a task unticked removed from,
 * the machine; every other task stays as it is *now*. All of one change are stored together or not at all.
 */

type ChangingPerson = ActorOf<(typeof changeMachinesActors)[number]>;

/** The tasks exactly as posted: a forged change may name one La Guardia does not know, or an ID that is none. */
export type ChangeMaintenanceTasksOfMachineInput = {
  machineId: string;
  seen: readonly string[];
  ticked: readonly string[];
};

export type ChangeMaintenanceTasksOfMachineError =
  "unknown-machine" | "machine-retired" | "maintenance-task-unknown" | "maintenance-task-removed";

/** The tasks the change touches – newly ticked or unticked, once each – in the order of the form. */
export function tasksTouched({
  seen,
  ticked,
}: Pick<ChangeMaintenanceTasksOfMachineInput, "seen" | "ticked">): string[] {
  const wasSeen = new Set(seen);
  const isTicked = new Set(ticked);
  return [
    ...new Set([...ticked.filter((taskId) => !wasSeen.has(taskId)), ...seen.filter((taskId) => !isTicked.has(taskId))]),
  ];
}

export function changeMaintenanceTasksOfMachine(
  plan: MaintenancePlan,
  input: ChangeMaintenanceTasksOfMachineInput,
  { actor, clock, newId }: DecisionContext<ChangingPerson>,
  chosen: ChosenMachines,
): Decision<MaintenancePlan, MachinesOfMaintenanceTaskChanged, ChangeMaintenanceTasksOfMachineError> {
  const machine = chosen.get(input.machineId);
  if (!machine) return { ok: false, error: "unknown-machine" };
  // A retired machine's maintenance can no longer change – also a change that would change nothing.
  if (machine.retired) return { ok: false, error: "machine-retired" };

  // The whole change is rejected, or none of it is stored: a task that is unknown (a forged change) or was removed
  // meanwhile (a removed task is final, invariant) rejects every tick.
  const touched = tasksTouched(input);
  const tasks = touched.map((taskId) => plan.maintenanceTasks.find((each) => each.id === taskId));
  if (tasks.some((task) => !task)) return { ok: false, error: "maintenance-task-unknown" };
  if (tasks.some((task) => task?.removedAt)) return { ok: false, error: "maintenance-task-removed" };

  const ticked = new Set(input.ticked);
  const now = clock.now();
  const changedBy = (actor satisfies { teamMemberId: TeamMemberId }).teamMemberId;
  let state = plan;
  const events: MachinesOfMaintenanceTaskChanged[] = [];
  for (const maintenanceTaskId of touched) {
    // Adding one that already applies, or removing one that no longer does, changes nothing.
    const applies = state.machinesOfTasks.some(
      (each) => each.maintenanceTaskId === maintenanceTaskId && each.machineId === input.machineId && !each.removedAt,
    );
    const wanted = ticked.has(maintenanceTaskId);
    if (wanted === applies) continue;
    const machines = { added: wanted ? [input.machineId] : [], removed: wanted ? [] : [input.machineId] };
    state = withMachinesChanged(state, maintenanceTaskId, machines, { now, newId });
    events.push({
      type: "EVT-MachinesOfMaintenanceTaskChanged",
      maintenanceTaskId,
      machinesAdded: machines.added,
      machinesRemoved: machines.removed,
      changedBy,
    });
  }
  return { ok: true, state: events.length === 0 ? plan : state, events };
}
