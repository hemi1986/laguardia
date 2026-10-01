import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { afterAll, describe, expect, it } from "vitest";
import { isolatedTestDatabase } from "@/test-support/isolated-database";

/**
 * Migrations applied to a database that already holds data – the step a deployment takes. In a database of its own,
 * migrated up to a given migration, filled the way production was at that point, then migrated to the end.
 */
const isolated = isolatedTestDatabase("migrations");

afterAll(() => isolated.close());

async function columnType(db: NodePgDatabase, table: string, column: string) {
  const { rows } = await db.execute<{ data_type: string }>(
    sql`SELECT data_type FROM information_schema.columns WHERE table_name = ${table} AND column_name = ${column}`,
  );
  return rows[0]?.data_type;
}

async function reportFor(db: NodePgDatabase, machineId: string) {
  await db.execute(sql`
    INSERT INTO problem_report (machine_id, description, reporter_kind, reported_at)
    VALUES (${machineId}, 'Left flipper is weak', 'visitor', now())`);
}

describe("migration 0005_machine", () => {
  it("ST-007: Spike problem reports are removed and problem reports refer to registered machines", async () => {
    const db = await isolated.reset("0004_machine_model");
    await reportFor(db, "test-machine");
    await reportFor(db, "test-machine");

    await isolated.migrate();

    const { rows } = await db.execute(sql`SELECT count(*)::int AS count FROM problem_report`);
    expect(rows).toEqual([{ count: 0 }]);
    expect(await columnType(db, "problem_report", "machine_id")).toBe("uuid");
    await expect(reportFor(db, randomUUID())).rejects.toMatchObject({
      cause: { constraint: "problem_report_machine_id_fk" },
    });
  });
});
