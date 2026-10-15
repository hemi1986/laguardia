import { sql } from "drizzle-orm";
import { aggregateCommand, type Database } from "@/platform/command";
import { MAINTENANCE_PLAN_ID } from "./maintenance-plan";
import { maintenancePlans } from "./maintenance-plans";

/**
 * Empties the maintenance plan of an isolated test database – never the shared one, where other tests add to the one
 * maintenance plan. The plan itself stays, at its version.
 */
export async function withoutMaintenanceTasks(db: Database): Promise<void> {
  const { rows } = await db.execute<{ name: string }>(sql`SELECT current_database() AS name`);
  if (!/^laguardia_.+_test$/.test(rows[0].name) || rows[0].name === "laguardia_test") {
    throw new Error(`withoutMaintenanceTasks only empties an isolated test database, not "${rows[0].name}"`);
  }
  await db.execute(sql`TRUNCATE maintenance_record, maintenance_task`);
}

/** Test stand-in for removing a maintenance task (CMD-ChangeMaintenancePlan, ST-041): it keeps `removedAt`. */
export const removeMaintenanceTaskForTest = aggregateCommand({
  id: "CMD-TestRemoveMaintenanceTask",
  allowedActors: ["technician"],
  store: maintenancePlans,
  target: (input: { maintenanceTaskId: string; version: number }) => ({
    id: MAINTENANCE_PLAN_ID,
    version: input.version,
  }),
  decide: (plan, input, { clock }) => ({
    ok: true as const,
    state: {
      ...plan,
      maintenanceTasks: plan.maintenanceTasks.map((task) =>
        task.id === input.maintenanceTaskId ? { ...task, removedAt: clock.now() } : task,
      ),
    },
    events: [{ type: "EVT-TestMaintenanceTaskRemoved" as const, maintenanceTaskId: input.maintenanceTaskId }],
  }),
  journal: (event) => ({
    type: event.type,
    aggregate: { type: "AGG-MaintenancePlan", id: MAINTENANCE_PLAN_ID },
    machineId: null,
    data: { maintenanceTaskId: event.maintenanceTaskId },
  }),
  result: () => ({}),
});
