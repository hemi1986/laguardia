import type { MachineOfTask, MaintenancePlan, MaintenanceTask, MaintenanceTaskWithMachines } from "./maintenance-plan";

/**
 * The machines of a maintenance task (CONTEXT.md: Machines of a maintenance task; ST-094, ST-095): one entry per task and
 * machine, kept for good. Removing a machine marks its entry (`removedAt`); adding it again starts the *same* entry anew,
 * so only maintenance records recorded since count for last done (HS-24) – `lastDoneByRecord` asks the same in SQL. A
 * retired machine's entry stays and never counts: the readers of Collection's machines leave it out themselves.
 */

/** Whether the machine is one of the task's machines now – its entry is there and not removed. */
export function appliesNow(entries: readonly MachineOfTask[], maintenanceTaskId: string, machineId: string): boolean {
  return entries.some(
    (each) => each.maintenanceTaskId === maintenanceTaskId && each.machineId === machineId && !each.removedAt,
  );
}

/** The tasks with the machines each applies to now – a machine removed from a task (ST-095) is not one of them. */
export function withMachines(
  tasks: readonly MaintenanceTask[],
  entries: readonly MachineOfTask[],
): MaintenanceTaskWithMachines[] {
  return tasks.map((task) => ({
    ...task,
    machines: entries.filter((each) => each.maintenanceTaskId === task.id && !each.removedAt),
  }));
}

/**
 * Whether a maintenance task applies to a machine: the machine is one of its machines now. A retired machine never
 * counts – the readers of Collection's machines leave it out themselves.
 */
export function maintenanceTaskAppliesTo(
  task: Pick<MaintenanceTaskWithMachines, "machines">,
  machineId: string,
): boolean {
  return task.machines.some((machine) => machine.machineId === machineId);
}

/**
 * The plan after machines were added to and removed from one maintenance task: a machine removed is marked, never
 * deleted; one added again after a removal starts its entry anew (HS-24); a new one gets a new entry. Adding one that
 * already applies changes nothing – its entry keeps when it was added, so last done is never reset – and removing one
 * that does not applies changes nothing either.
 */
export function withMachinesChanged(
  plan: MaintenancePlan,
  maintenanceTaskId: string,
  { added, removed }: { added: readonly string[]; removed: readonly string[] },
  { now, newId }: { now: Date; newId: () => string },
): MaintenancePlan {
  const entries = plan.machinesOfTasks.filter((each) => each.maintenanceTaskId === maintenanceTaskId);
  const toAdd = added.filter((machineId) => !appliesNow(entries, maintenanceTaskId, machineId));
  const addedMachines = toAdd.map((machineId) => {
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
