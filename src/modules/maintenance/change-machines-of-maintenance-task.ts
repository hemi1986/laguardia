import type { ActorOf, Decision, DecisionContext, Role } from "@/platform/command";
import {
  machinesRefusal,
  type ChangeMaintenancePlanError,
  type MachinesOfMaintenanceTaskChanged,
} from "./change-maintenance-plan";
import type { ChosenMachines } from "./chosen-machines";
import type { MaintenancePlan } from "./maintenance-plan";
import { appliesNow, withMachinesChanged } from "./machines-of-maintenance-task";

/**
 * CMD-ChangeMachinesOfMaintenanceTask (AGG-MaintenancePlan): a technician changes the machines of a maintenance task –
 * from the task (ST-095: one task, its machines ticked) or from the machine record (ST-096: one machine, the tasks that
 * apply to it ticked). Either way the command carries what the technician *changed*, not the whole list: the entries as
 * they were ticked when the page opened (`seen`) and as they are ticked now. One side is fixed (the task, or the
 * machine), the other is ticked; every pair the change touches is applied to the plan as it is stored *now*:
 *
 * - newly ticked → added, unless it already applies (someone else added it): nothing to do, not a rejection;
 * - unticked → removed, unless it no longer applies, or it is no longer offered (a machine retired, a task removed
 *   meanwhile): not being offered is not unticking it, so a retry after a rejection still means what was changed;
 * - the whole change is rejected, or none of it is stored: the fixed side unknown, retired or removed (also when nothing
 *   would change), an entry ticked twice (a forged form), a newly ticked one unknown, retired or removed.
 *
 * One EVT-MachinesOfMaintenanceTaskChanged per task that changed, none when nothing did.
 */

/** Who may change the machines of a maintenance task – technicians only. */
export const changeMachinesActors = ["technician"] as const;

type ChangingPerson = ActorOf<(typeof changeMachinesActors)[number]>;

/** Whether a team member in this role is offered the change (G11) – the command's own actor list decides. */
export function changeMachinesOffered(role: Role): boolean {
  return changeMachinesActors.some((actor) => actor === role);
}

/**
 * From a task (ST-095): the *machines* exactly as posted – a forged change may name one La Guardia does not know, or one
 * twice. `seen` and `ticked` hold only what the page offered – a retired machine is in neither.
 */
export type ChangeMachinesOfMaintenanceTaskInput = {
  maintenanceTaskId: string;
  seen: readonly string[];
  ticked: readonly string[];
};

/** From the machine record (ST-096): the *maintenance tasks* exactly as posted – a forged change may name an unknown one. */
export type ChangeMaintenanceTasksOfMachineInput = {
  machineId: string;
  seen: readonly string[];
  ticked: readonly string[];
};

export type ChangeMachinesOfMaintenanceTaskError =
  | "maintenance-task-unknown"
  | Extract<ChangeMaintenancePlanError, "unknown-machine" | "machine-retired" | "machine-chosen-twice">;

export type ChangeMaintenanceTasksOfMachineError =
  | "unknown-machine"
  | "machine-retired"
  | "maintenance-task-unknown"
  | "maintenance-task-removed"
  | "maintenance-task-chosen-twice";

export type ChangeInput = ChangeMachinesOfMaintenanceTaskInput | ChangeMaintenanceTasksOfMachineInput;
type ChangeError = ChangeMachinesOfMaintenanceTaskError | ChangeMaintenanceTasksOfMachineError;

/** The entries the change touches: newly ticked and unticked, once each, in the order of the form. */
export function touched({ seen, ticked }: Pick<ChangeInput, "seen" | "ticked">): {
  newlyTicked: string[];
  unticked: string[];
} {
  const wasSeen = new Set(seen);
  const isTicked = new Set(ticked);
  return {
    newlyTicked: [...new Set(ticked.filter((id) => !wasSeen.has(id)))],
    unticked: [...new Set(seen.filter((id) => !isTicked.has(id)))],
  };
}

/** One pair of the change: a task and a machine, and whether the task is to apply to it (add) or no longer (remove). */
type Tick = { maintenanceTaskId: string; machineId: string; kind: "add" | "remove" };

export function changeMachinesOfMaintenanceTask(
  plan: MaintenancePlan,
  input: ChangeMachinesOfMaintenanceTaskInput,
  context: DecisionContext<ChangingPerson>,
  chosen: ChosenMachines,
): Decision<MaintenancePlan, MachinesOfMaintenanceTaskChanged, ChangeMachinesOfMaintenanceTaskError>;
export function changeMachinesOfMaintenanceTask(
  plan: MaintenancePlan,
  input: ChangeMaintenanceTasksOfMachineInput,
  context: DecisionContext<ChangingPerson>,
  chosen: ChosenMachines,
): Decision<MaintenancePlan, MachinesOfMaintenanceTaskChanged, ChangeMaintenanceTasksOfMachineError>;
export function changeMachinesOfMaintenanceTask(
  plan: MaintenancePlan,
  input: ChangeInput,
  context: DecisionContext<ChangingPerson>,
  chosen: ChosenMachines,
): Decision<MaintenancePlan, MachinesOfMaintenanceTaskChanged, ChangeError>;
export function changeMachinesOfMaintenanceTask(
  plan: MaintenancePlan,
  input: ChangeInput,
  context: DecisionContext<ChangingPerson>,
  chosen: ChosenMachines,
): Decision<MaintenancePlan, MachinesOfMaintenanceTaskChanged, ChangeError> {
  const ticks = "machineId" in input ? ticksOfMachine(plan, input, chosen) : ticksOfTask(plan, input, chosen);
  if (!ticks.ok) return ticks;
  return applied(plan, ticks.ticks, context);
}

/** From a task (ST-095): the task is fixed, its machines are ticked. */
function ticksOfTask(
  plan: MaintenancePlan,
  input: ChangeMachinesOfMaintenanceTaskInput,
  chosen: ChosenMachines,
): { ok: true; ticks: Tick[] } | { ok: false; error: ChangeMachinesOfMaintenanceTaskError } {
  // A removed maintenance task is final: its machines never change again (invariant).
  const task = plan.maintenanceTasks.find((each) => each.id === input.maintenanceTaskId && !each.removedAt);
  if (!task) return { ok: false, error: "maintenance-task-unknown" };
  const applies = (machineId: string) => appliesNow(plan.machinesOfTasks, task.id, machineId);
  const { newlyTicked, unticked } = touched(input);
  // Only the machines to add need a check – one already among the machines needs none.
  const added = newlyTicked.filter((machineId) => !applies(machineId));
  const refusal = machinesRefusal(input.ticked, chosen, added);
  if (refusal) return { ok: false, error: refusal };
  // A machine retired meanwhile is no longer offered: it stays among the machines.
  const removed = unticked.filter((machineId) => applies(machineId) && !chosen.get(machineId)?.retired);
  return {
    ok: true,
    ticks: [
      ...added.map((machineId) => ({ maintenanceTaskId: task.id, machineId, kind: "add" as const })),
      ...removed.map((machineId) => ({ maintenanceTaskId: task.id, machineId, kind: "remove" as const })),
    ],
  };
}

/** From the machine record (ST-096): the machine is fixed, the maintenance tasks are ticked. */
function ticksOfMachine(
  plan: MaintenancePlan,
  input: ChangeMaintenanceTasksOfMachineInput,
  chosen: ChosenMachines,
): { ok: true; ticks: Tick[] } | { ok: false; error: ChangeMaintenanceTasksOfMachineError } {
  const machine = chosen.get(input.machineId);
  if (!machine) return { ok: false, error: "unknown-machine" };
  // A retired machine's maintenance can no longer change – also a change that would change nothing.
  if (machine.retired) return { ok: false, error: "machine-retired" };
  if (new Set(input.ticked).size !== input.ticked.length) return { ok: false, error: "maintenance-task-chosen-twice" };
  const applies = (maintenanceTaskId: string) => appliesNow(plan.machinesOfTasks, maintenanceTaskId, input.machineId);
  const taskOf = (maintenanceTaskId: string) => plan.maintenanceTasks.find((each) => each.id === maintenanceTaskId);
  const { newlyTicked, unticked } = touched(input);
  // Only the tasks to add need a check – one that already applies needs none.
  const added = newlyTicked.filter((maintenanceTaskId) => !applies(maintenanceTaskId));
  if (added.some((maintenanceTaskId) => !taskOf(maintenanceTaskId)))
    return { ok: false, error: "maintenance-task-unknown" };
  if (added.some((maintenanceTaskId) => taskOf(maintenanceTaskId)?.removedAt)) {
    return { ok: false, error: "maintenance-task-removed" };
  }
  // A task removed meanwhile is no longer offered: unticking it is nothing to do.
  const removed = unticked.filter(
    (maintenanceTaskId) => applies(maintenanceTaskId) && !taskOf(maintenanceTaskId)?.removedAt,
  );
  return {
    ok: true,
    ticks: [...added, ...removed].map((maintenanceTaskId) => ({
      maintenanceTaskId,
      machineId: input.machineId,
      kind: added.includes(maintenanceTaskId) ? ("add" as const) : ("remove" as const),
    })),
  };
}

/** The plan with every tick applied, one event per task that changed – the loaded plan itself when nothing did. */
function applied(
  plan: MaintenancePlan,
  ticks: readonly Tick[],
  { actor, clock, newId }: DecisionContext<ChangingPerson>,
): Decision<MaintenancePlan, MachinesOfMaintenanceTaskChanged, never> {
  if (ticks.length === 0) return { ok: true, state: plan, events: [] };
  const byTask = new Map<string, { added: string[]; removed: string[] }>();
  for (const { maintenanceTaskId, machineId, kind } of ticks) {
    const machines = byTask.get(maintenanceTaskId) ?? { added: [], removed: [] };
    (kind === "add" ? machines.added : machines.removed).push(machineId);
    byTask.set(maintenanceTaskId, machines);
  }
  const now = clock.now();
  let state = plan;
  for (const [maintenanceTaskId, machines] of byTask) {
    state = withMachinesChanged(state, maintenanceTaskId, machines, { now, newId });
  }
  return {
    ok: true,
    state,
    events: [...byTask].map(([maintenanceTaskId, { added, removed }]) => ({
      type: "EVT-MachinesOfMaintenanceTaskChanged",
      maintenanceTaskId,
      machinesAdded: added,
      machinesRemoved: removed,
      changedBy: actor.teamMemberId,
    })),
  };
}
