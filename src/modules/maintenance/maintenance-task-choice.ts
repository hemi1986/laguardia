import type { Database } from "@/platform/command";
import { activeMaintenanceTasks } from "./maintenance-plans";

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
 * RM-MaintenanceTaskChoiceForMachine (ST-096): the maintenance tasks a technician can choose for one machine – every task
 * of the maintenance plan that is not removed, in groups by interval, the shortest first, by name inside a group (G27);
 * each says whether it applies to the machine.
 */
export async function maintenanceTaskChoiceForMachine(db: Database, machineId: string): Promise<TaskGroup[]> {
  const groups = new Map<number, ChoosableTask[]>();
  for (const task of await activeMaintenanceTasks(db)) {
    const tasks = groups.get(task.intervalMonths) ?? [];
    tasks.push({
      maintenanceTaskId: task.id,
      name: task.name,
      suitableForHelpers: task.suitableForHelpers,
      chosen: task.machines.some((machine) => machine.machineId === machineId),
    });
    groups.set(task.intervalMonths, tasks);
  }
  return [...groups]
    .sort(([a], [b]) => a - b)
    .map(([intervalMonths, tasks]) => ({
      intervalMonths,
      tasks: tasks.sort((a, b) => a.name.localeCompare(b.name, "de")),
    }));
}
