import { sql } from "drizzle-orm";
import { journalOf, type Database } from "@/platform/command";
import { MAINTENANCE_PLAN_ID } from "./maintenance-plan";

/**
 * Empties the maintenance plan of an isolated test database – never the shared one, where other tests add to the one
 * maintenance plan. The plan itself stays, at its version.
 */
export async function withoutMaintenanceTasks(db: Database): Promise<void> {
  const { rows } = await db.execute<{ name: string }>(sql`SELECT current_database() AS name`);
  if (!/^laguardia_.+_test$/.test(rows[0].name) || rows[0].name === "laguardia_test") {
    throw new Error(`withoutMaintenanceTasks only empties an isolated test database, not "${rows[0].name}"`);
  }
  await db.execute(sql`TRUNCATE maintenance_record, maintenance_task_machine, maintenance_task`);
}

/** The journal of the one maintenance plan – every change of it, the oldest first. */
export function maintenancePlanJournal(db: Database) {
  return journalOf(db, { aggregateId: MAINTENANCE_PLAN_ID });
}
