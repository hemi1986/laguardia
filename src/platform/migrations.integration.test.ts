import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { afterAll, describe, expect, it } from "vitest";
import { dueMaintenance, maintenancePlan } from "@/modules/maintenance";
import { fixedClock } from "@/platform/clock";
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

/** The state production had before ST-094: tasks restricted to a machine category and technology, with a start date. */
async function beforeSt094(db: NodePgDatabase) {
  const tom = randomUUID();
  await db.execute(sql`
    INSERT INTO team_member (id, name, email, username, role)
    VALUES (${tom}, 'Tom', 'tom@example.org', 'tom', 'technician')`);
  const model = async (title: string, category: string, technology: string) => {
    const id = randomUUID();
    await db.execute(sql`
      INSERT INTO machine_model (id, title, manufacturer, machine_category, technology)
      VALUES (${id}, ${title}, 'Bally', ${category}, ${technology})`);
    await db.execute(sql`
      INSERT INTO machine_model_category_change (id, machine_model_id, machine_category, technology, holds_from)
      VALUES (${randomUUID()}, ${id}, ${category}, ${technology}, '2025-01-01T00:00:00Z')`);
    return id;
  };
  const machine = async (modelId: string, museumNumber: string, registeredAt: string, retired = false) => {
    const id = randomUUID();
    await db.execute(sql`
      INSERT INTO machine (id, museum_number, machine_model_id, location, machine_status, registered_at, retired_at,
        retired_by, retirement_reason)
      VALUES (${id}, ${museumNumber}, ${modelId}, 'Hall 1', 'in-order', ${registeredAt},
        ${retired ? "2026-03-01T00:00:00Z" : null}, ${retired ? tom : null}, ${retired ? "Sold" : null})`);
    return id;
  };
  const task = async (name: string, startDate: string, restriction?: { category: string; technology?: string }) => {
    const id = randomUUID();
    await db.execute(sql`
      INSERT INTO maintenance_task (id, maintenance_plan_id, name, instruction, interval_months, suitable_for_helpers,
        machine_category, technology, start_date)
      VALUES (${id}, '7a1e0f40-0000-4000-8000-000000000040', ${name}, 'Do it', 12, false,
        ${restriction?.category ?? null}, ${restriction?.technology ?? null}, ${startDate})`);
    return id;
  };
  const done = async (taskId: string, machineId: string, date: string, recordedAt: string) => {
    await db.execute(sql`
      INSERT INTO maintenance_record (id, machine_id, maintenance_task_id, outcome, date, recorded_by, recorded_at)
      VALUES (${randomUUID()}, ${machineId}, ${taskId}, 'done', ${date}, ${tom}, ${recordedAt})`);
  };
  return { model, machine, task, done };
}

async function machinesOf(db: NodePgDatabase, taskId: string) {
  const { rows } = await db.execute<{ museum_number: string; added_at: Date }>(sql`
    SELECT m.museum_number, tm.added_at FROM maintenance_task_machine tm JOIN machine m ON m.id = tm.machine_id
    WHERE tm.maintenance_task_id = ${taskId} ORDER BY m.museum_number`);
  return rows.map((row) => ({ museumNumber: row.museum_number, addedAt: new Date(row.added_at).toISOString() }));
}

describe("migration 0032_maintenance_task_machines", () => {
  it("ST-094: Migration – existing tasks apply to the machines they apply to today", async () => {
    const db = await isolated.reset("0031_file-removal");
    const before = await beforeSt094(db);
    const em = await before.model("Fireball", "pinball", "em");
    const dmd = await before.model("Medieval Madness", "pinball", "dmd");
    await before.machine(em, "LG-005", "2025-11-01T10:00:00Z");
    await before.machine(dmd, "LG-042", "2025-11-01T10:00:00Z");
    await before.machine(em, "LG-007", "2025-11-01T10:00:00Z", true);
    const reels = await before.task("Clean & adjust score reels / stepper units", "2026-01-01", {
      category: "pinball",
      technology: "em",
    });
    const journalBefore = await db.execute(sql`SELECT count(*)::int AS count FROM event_journal`);

    await isolated.migrate();

    expect((await machinesOf(db, reels)).map((each) => each.museumNumber)).toEqual(["LG-005"]);
    // The maintenance plan shows how many machines it applies to – a retired machine does not count.
    expect((await maintenancePlan(db)).maintenanceTasks).toEqual([
      expect.objectContaining({ id: reels, machineCount: 1 }),
    ]);
    expect(await db.execute(sql`SELECT count(*)::int AS count FROM event_journal`)).toMatchObject({
      rows: journalBefore.rows,
    });
  });

  it("ST-094: Migration – a machine with a done record keeps its due date", async () => {
    const db = await isolated.reset("0031_file-removal");
    const before = await beforeSt094(db);
    const em = await before.model("Fireball", "pinball", "em");
    const lg005 = await before.machine(em, "LG-005", "2025-11-01T10:00:00Z");
    const wax = await before.task("Wax playfield", "2026-01-01");
    await before.done(wax, lg005, "2026-03-01", "2026-03-01T10:00:00Z");

    await isolated.migrate();

    const due = (clock: string) => dueMaintenance(db, fixedClock(clock));
    expect(await due("2027-02-28T10:00:00Z")).toEqual([]);
    expect(await due("2027-03-01T10:00:00Z")).toEqual([
      expect.objectContaining({
        id: wax,
        machines: [expect.objectContaining({ machineId: lg005, lastDone: "2026-03-01", dueSince: "2027-03-01" })],
      }),
    ]);
    // The maintenance record stays where it was.
    const { rows } = await db.execute(sql`SELECT count(*)::int AS count FROM maintenance_record`);
    expect(rows).toEqual([{ count: 1 }]);
  });

  it("ST-094: Migration – a machine without a done record is due at once", async () => {
    const db = await isolated.reset("0031_file-removal");
    const before = await beforeSt094(db);
    const dmd = await before.model("Medieval Madness", "pinball", "dmd");
    const lg042 = await before.machine(dmd, "LG-042", "2025-06-01T10:00:00Z");
    const wax = await before.task("Wax playfield", "2026-01-01");

    await isolated.migrate();

    // Added at the start date, midnight in Berlin: due since then, without a last done date.
    expect((await machinesOf(db, wax)).map((each) => each.addedAt)).toEqual(["2025-12-31T23:00:00.000Z"]);
    expect(await dueMaintenance(db, fixedClock("2026-06-10T10:00:00Z"))).toEqual([
      expect.objectContaining({
        id: wax,
        machines: [expect.objectContaining({ machineId: lg042, lastDone: undefined, dueSince: "2026-01-01" })],
      }),
    ]);
  });
});

describe("migration 0039_ai_work", () => {
  it("the AI index can store embeddings of 1536 numbers – the vector extension is enabled (ST-112, ADR 0014)", async () => {
    const db = await isolated.reset();

    const { rows } = await db.execute<{ distance: number }>(
      sql`SELECT (array_fill(0.5, ARRAY[1536])::vector(1536) <=> array_fill(0.5, ARRAY[1536])::vector(1536)) AS distance`,
    );
    expect(rows).toEqual([{ distance: 0 }]);
  });
});
