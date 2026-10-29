import { machinesForMaintenance, type MachineCategory, type Technology } from "@/modules/collection";
import type { Database } from "@/platform/command";
import { activeMaintenanceTasks } from "./maintenance-plans";
import { maintenanceTaskAppliesTo } from "./machines-of-maintenance-task";
import type { MaintenanceTaskWithMachines } from "./maintenance-plan";

/** A maintenance task a technician can choose for a machine – what they recognise it by, and whether it applies. */
export type ChoosableTask = {
  maintenanceTaskId: string;
  name: string;
  suitableForHelpers: boolean;
  /** The task applies to the machine. */
  chosen: boolean;
};

/** The maintenance tasks with one interval – the group of the choice (G27). */
export type TaskGroup = { intervalMonths: number; tasks: ChoosableTask[] };

/**
 * Every task of the maintenance plan that is not removed, in groups by interval, the shortest first, by name inside a
 * group (G27); `chosen` says for each whether it applies.
 */
function grouped(
  tasks: readonly MaintenanceTaskWithMachines[],
  chosen: (task: MaintenanceTaskWithMachines) => boolean,
): TaskGroup[] {
  const groups = new Map<number, ChoosableTask[]>();
  for (const task of tasks) {
    const group = groups.get(task.intervalMonths) ?? [];
    group.push({
      maintenanceTaskId: task.id,
      name: task.name,
      suitableForHelpers: task.suitableForHelpers,
      chosen: chosen(task),
    });
    groups.set(task.intervalMonths, group);
  }
  return [...groups]
    .sort(([a], [b]) => a - b)
    .map(([intervalMonths, tasks]) => ({
      intervalMonths,
      tasks: tasks.sort((a, b) => a.name.localeCompare(b.name, "de")),
    }));
}

/**
 * RM-MaintenanceTaskChoiceForMachine (ST-096): the maintenance tasks a technician can choose for one machine – every task
 * of the maintenance plan that is not removed, in groups by interval, the shortest first, by name inside a group (G27);
 * each says whether it applies to the machine.
 */
export async function maintenanceTaskChoiceForMachine(db: Database, machineId: string): Promise<TaskGroup[]> {
  return grouped(await activeMaintenanceTasks(db), (task) => maintenanceTaskAppliesTo(task, machineId));
}

/** A machine model as the choice for a new machine needs it: what kind of machine it is. */
export type ModelOfNewMachine = { id: string; machineCategory: MachineCategory; technology?: Technology };

/** One machine category and technology as a key – the technology none for a category without one. */
const groupKey = ({ machineCategory, technology }: { machineCategory: MachineCategory; technology?: Technology }) =>
  `${machineCategory}/${technology ?? ""}`;

/** What the registration form offers (ST-097): every task, none ticked, and which tasks each machine model proposes. */
export type ChoiceForNewMachine = {
  groups: TaskGroup[];
  /** By machine model ID: the tasks proposed for a new machine of it – a model with nothing to propose has none. */
  proposedFor: Record<string, string[]>;
};

/**
 * RM-MaintenanceTaskChoiceForMachine for a machine being registered (ST-097) – *Proposed for a new machine*: a task is
 * proposed when it applies to at least one machine that is not retired and whose machine model has the same machine
 * category and technology as the new machine's (data model). Collection publishes its machines for maintenance without
 * the retired ones, so a task that applies only to retired machines proposes nothing. The page passes the machine models
 * the registration chooses from.
 */
export async function maintenanceTaskChoiceForNewMachine(
  db: Database,
  models: readonly ModelOfNewMachine[],
): Promise<ChoiceForNewMachine> {
  const [tasks, machines] = await Promise.all([activeMaintenanceTasks(db), machinesForMaintenance(db)]);
  const groups = grouped(tasks, () => false);
  const ordered = groups.flatMap((group) => group.tasks.map((task) => task.maintenanceTaskId));
  // Once over the machines the tasks apply to: the tasks proposed per machine category and technology.
  const machineGroup = new Map(machines.map((machine) => [machine.id, groupKey(machine)]));
  const proposedByGroup = new Map<string, Set<string>>();
  for (const task of tasks) {
    for (const { machineId } of task.machines) {
      const key = machineGroup.get(machineId);
      if (key === undefined) continue; // retired – Collection does not publish it for maintenance
      proposedByGroup.set(key, (proposedByGroup.get(key) ?? new Set()).add(task.id));
    }
  }
  const proposedFor: Record<string, string[]> = {};
  for (const model of models) {
    const proposed = proposedByGroup.get(groupKey(model));
    if (proposed) proposedFor[model.id] = ordered.filter((id) => proposed.has(id));
  }
  return { groups, proposedFor };
}
