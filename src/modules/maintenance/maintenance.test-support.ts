import { sql } from "drizzle-orm";
import type { Database } from "@/platform/command";

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
