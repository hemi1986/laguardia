import { sql } from "drizzle-orm";
import type { Database } from "@/platform/command";

/**
 * Test support for machines – only imported by tests. Empties the machine tables of an isolated test database
 * (`isolatedTestDatabase`), so a test can arrange "the highest museum number is LG-041". Never the shared one.
 */
export async function withoutMachines(db: Database): Promise<void> {
  await db.execute(sql`TRUNCATE machine, museum_number, machine_status_change, problem_report CASCADE`);
}
