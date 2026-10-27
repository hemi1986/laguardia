import { eq } from "drizzle-orm";
import { machinesForMaintenance } from "@/modules/collection";
import { aggregateStore, entities, type Database } from "@/platform/command";
import {
  MAINTENANCE_PLAN_ID,
  type MachineOfTask,
  type MaintenancePlan,
  type MaintenanceTask,
  type MaintenanceTaskWithMachines,
} from "./maintenance-plan";
import { maintenancePlan as maintenancePlanTable, maintenanceTask, maintenanceTaskMachine } from "./schema";

/** The maintenance tasks of the plan (ST-040) – changed in place, never deleted. */
const maintenanceTasks = entities({
  table: maintenanceTask,
  owner: "maintenancePlanId",
  toEntity: (row): MaintenanceTask => ({
    id: row.id,
    name: row.name,
    instruction: row.instruction,
    intervalMonths: row.intervalMonths,
    suitableForHelpers: row.suitableForHelpers,
    removedAt: row.removedAt ?? undefined,
  }),
  // null, not undefined: an update leaves out undefined columns.
  toRow: (task) => ({ ...task, removedAt: task.removedAt ?? null }),
});

/**
 * The machines of the maintenance tasks (ST-094): one entry per task and machine, kept for good. Removing a machine marks
 * its entry (`removedAt`), adding it again starts the entry anew (ST-095) – the journal keeps who did what and when.
 */
const machinesOfTasks = entities({
  table: maintenanceTaskMachine,
  owner: "maintenancePlanId",
  toEntity: (row): MachineOfTask => ({
    id: row.id,
    maintenanceTaskId: row.maintenanceTaskId,
    machineId: row.machineId,
    addedAt: row.addedAt,
    removedAt: row.removedAt ?? undefined,
  }),
  // null, not undefined: an update leaves out undefined columns.
  toRow: (machine) => ({ ...machine, removedAt: machine.removedAt ?? null }),
});

/** How AGG-MaintenancePlan is stored (ST-040): its one row, versioned (HS-16), with its maintenance tasks and their machines. */
export const maintenancePlans = aggregateStore({
  type: "AGG-MaintenancePlan",
  table: maintenancePlanTable,
  entities: { maintenanceTasks, machinesOfTasks },
  toState: (row, lists): MaintenancePlan => ({
    id: row.id,
    maintenanceTasks: lists.maintenanceTasks,
    machinesOfTasks: lists.machinesOfTasks,
  }),
  toRow: (plan: MaintenancePlan) => ({ id: plan.id }),
});

/** A maintenance task as the maintenance plan lists it (RM-MaintenancePlan), with how many machines it applies to. */
export type ListedMaintenanceTask = Omit<MaintenanceTask, "removedAt"> & {
  /** Machines it applies to that are not retired – a retired machine never counts (ST-094). */
  machineCount: number;
};

/** The version of the maintenance plan – what the form page of adding a maintenance task posts (HS-16). */
export async function maintenancePlanVersion(db: Database): Promise<number> {
  const [row] = await db
    .select({ version: maintenancePlanTable.version })
    .from(maintenancePlanTable)
    .where(eq(maintenancePlanTable.id, MAINTENANCE_PLAN_ID));
  return row?.version ?? 0;
}

/**
 * RM-MaintenancePlan (ST-040, ST-094): the maintenance plan's tasks that are not removed, in the order they were added,
 * how many machines each applies to – counting only machines Collection publishes for maintenance, which are not
 * retired – and the version a change of the plan names (HS-16).
 */
export async function maintenancePlan(
  db: Database,
): Promise<{ version: number; maintenanceTasks: ListedMaintenanceTask[] }> {
  const [version, tasks, machines] = await Promise.all([
    maintenancePlanVersion(db),
    activeMaintenanceTasks(db),
    machinesForMaintenance(db),
  ]);
  const notRetired = new Set(machines.map((machine) => machine.id));
  return {
    version,
    maintenanceTasks: tasks.map(({ machines: ofTask, removedAt: _removedAt, ...task }) => ({
      ...task,
      machineCount: ofTask.filter((machine) => notRetired.has(machine.machineId)).length,
    })),
  };
}

/**
 * The name of a maintenance task of the plan, also of a removed one – what a confirmation names (ST-041); none for an
 * ID that is no maintenance task.
 */
export async function maintenanceTaskName(db: Database, maintenanceTaskId: string): Promise<string | undefined> {
  const [row] = await db
    .select({ name: maintenanceTask.name })
    .from(maintenanceTask)
    .where(eq(maintenanceTask.id, maintenanceTaskId));
  return row?.name;
}

/** The maintenance tasks of the plan that are not removed, with their machines – a removed task is never due (invariant). */
export async function activeMaintenanceTasks(db: Database): Promise<MaintenanceTaskWithMachines[]> {
  const [tasks, machines] = await Promise.all([
    maintenanceTasks.load(db, [MAINTENANCE_PLAN_ID]),
    machinesOfTasks.load(db, [MAINTENANCE_PLAN_ID]),
  ]);
  return withMachines(tasks.get(MAINTENANCE_PLAN_ID) ?? [], machines.get(MAINTENANCE_PLAN_ID) ?? []).filter(
    (task) => !task.removedAt,
  );
}

/** The tasks with the machines each applies to now – a machine removed from a task (ST-095) is not one of them. */
export function withMachines(tasks: MaintenanceTask[], machines: MachineOfTask[]): MaintenanceTaskWithMachines[] {
  return tasks.map((task) => ({
    ...task,
    machines: machines.filter((each) => each.maintenanceTaskId === task.id && !each.removedAt),
  }));
}

/**
 * Whether a maintenance task applies to a machine (CONTEXT.md: Machines of a maintenance task): the machine is one of
 * its machines. A retired machine never counts – the readers of Collection's machines leave it out themselves.
 */
export function maintenanceTaskAppliesTo(
  task: Pick<MaintenanceTaskWithMachines, "machines">,
  machineId: string,
): boolean {
  return task.machines.some((machine) => machine.machineId === machineId);
}
