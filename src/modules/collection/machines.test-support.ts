import { sql } from "drizzle-orm";
import type { Database } from "@/platform/command";
import { machines } from "./machines";

/**
 * Test support for machines – only imported by tests. Empties the machine tables of an isolated test database
 * (`isolatedTestDatabase`), so a test can arrange "the highest museum number is LG-041". Never the shared one.
 */
export async function withoutMachines(db: Database): Promise<void> {
  const { rows } = await db.execute<{ name: string }>(sql`SELECT current_database() AS name`);
  if (!/^laguardia_.+_test$/.test(rows[0].name) || rows[0].name === "laguardia_test") {
    throw new Error(`withoutMachines only empties an isolated test database, not "${rows[0].name}"`);
  }
  await db.execute(sql`TRUNCATE machine, museum_number, machine_status_change, problem_report, file CASCADE`);
}

/** A machine as stored – for checks at the command seam that no read model of that test's database shows. */
export async function storedMachine(db: Database, machineId: string) {
  return (await machines.load(db, machineId))?.state;
}
