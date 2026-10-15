import { eq } from "drizzle-orm";
import type { MachineCategory, Technology } from "@/modules/collection";
import { aggregateStore, entities, type Database } from "@/platform/command";
import { maintenanceDates, type CalendarDate } from "@/platform/time";
import { MAINTENANCE_PLAN_ID, type MaintenancePlan, type MaintenanceTask } from "./maintenance-plan";
import { maintenancePlan as maintenancePlanTable, maintenanceTask } from "./schema";

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
    machineCategory: row.machineCategory ?? undefined,
    technology: row.technology ?? undefined,
    startDate: row.startDate,
    removedAt: row.removedAt ?? undefined,
  }),
  // null, not undefined: an update leaves out undefined columns.
  toRow: (task) => ({
    ...task,
    machineCategory: task.machineCategory ?? null,
    technology: task.technology ?? null,
    removedAt: task.removedAt ?? null,
  }),
});

/** How AGG-MaintenancePlan is stored (ST-040): its one row, versioned (HS-16), with its maintenance tasks. */
export const maintenancePlans = aggregateStore({
  type: "AGG-MaintenancePlan",
  table: maintenancePlanTable,
  entities: { maintenanceTasks },
  toState: (row, lists): MaintenancePlan => ({ id: row.id, maintenanceTasks: lists.maintenanceTasks }),
  toRow: (plan: MaintenancePlan) => ({ id: plan.id }),
});

/** A maintenance task as the maintenance plan lists it (RM-MaintenancePlan), with when it is first due. */
export type ListedMaintenanceTask = Omit<MaintenanceTask, "removedAt"> & {
  /** One interval after its start date, which counts as last done (HS-12) – month ends clamped (ST-003). */
  firstDue: CalendarDate;
};

/**
 * RM-MaintenancePlan (ST-040): the maintenance plan's tasks that are not removed, in the order they were added, and the
 * version a change of the plan names (HS-16).
 */
export async function maintenancePlan(
  db: Database,
): Promise<{ version: number; maintenanceTasks: ListedMaintenanceTask[] }> {
  const [row] = await db
    .select({ version: maintenancePlanTable.version })
    .from(maintenancePlanTable)
    .where(eq(maintenancePlanTable.id, MAINTENANCE_PLAN_ID));
  const tasks = (await maintenanceTasks.load(db, [MAINTENANCE_PLAN_ID])).get(MAINTENANCE_PLAN_ID) ?? [];
  return {
    version: row?.version ?? 0,
    maintenanceTasks: tasks
      .filter((task) => !task.removedAt)
      .map(({ removedAt: _removed, ...task }) => ({
        ...task,
        firstDue: maintenanceDates(task.startDate, task.intervalMonths).dueDate,
      })),
  };
}

/**
 * Whether a maintenance task applies to a machine of the given machine model (HS-10): without a restriction to every
 * machine, with one only to machines whose machine model has that machine category – and, if the task names one, that
 * technology. The due maintenance list (ST-043) asks it per machine.
 */
export function maintenanceTaskAppliesTo(
  task: Pick<MaintenanceTask, "machineCategory" | "technology">,
  model: { machineCategory: MachineCategory; technology: Technology | undefined },
): boolean {
  if (task.machineCategory && task.machineCategory !== model.machineCategory) return false;
  if (task.technology && task.technology !== model.technology) return false;
  return true;
}
