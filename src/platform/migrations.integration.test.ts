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

describe("migration 0023_machine_model_category_history", () => {
  it("every machine model gets its creation as the first entry of its category history (ST-036)", async () => {
    const db = await isolated.reset("0022_defect_reopening");
    const fireball = randomUUID();
    await db.execute(sql`
      INSERT INTO machine_model (id, title, manufacturer, machine_category, technology)
      VALUES (${fireball}, 'Fireball', 'Bally', 'pinball', 'solid-state')`);
    await db.execute(sql`
      INSERT INTO event_journal (type, occurred_at, actor_kind, aggregate_type, aggregate_id, data)
      VALUES ('EVT-MachineModelCreated', '2026-02-01T10:00:00Z', 'team-member', 'AGG-MachineModel', ${fireball},
        '{"machineCategory": "pinball", "technology": "solid-state"}')`);

    await isolated.migrate();

    const { rows } = await db.execute(sql`
      SELECT machine_category, technology, holds_from = '2026-02-01T10:00:00Z' AS from_creation FROM machine_model_category_change
      WHERE machine_model_id = ${fireball}`);
    expect(rows).toEqual([
      { machine_category: "pinball", technology: "solid-state", from_creation: true },
    ]);
  });

  it("a machine model the journal knows no creation of still gets its first entry (ST-036 code review)", async () => {
    const db = await isolated.reset("0022_defect_reopening");
    const galaxian = randomUUID();
    await db.execute(sql`
      INSERT INTO machine_model (id, title, manufacturer, machine_category, technology)
      VALUES (${galaxian}, 'Galaxian', 'Namco', 'arcade', 'crt')`);

    await isolated.migrate();

    const { rows } = await db.execute(sql`
      SELECT machine_category, technology FROM machine_model_category_change WHERE machine_model_id = ${galaxian}`);
    expect(rows).toEqual([{ machine_category: "arcade", technology: "crt" }]);
  });
});
