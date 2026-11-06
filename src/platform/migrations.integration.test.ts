import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { afterAll, describe, expect, it } from "vitest";
import { aiAssessmentWork, aiIndexOverview, filesContainingWords } from "@/modules/ai-assistance";
import { aiScenario } from "@/modules/ai-assistance/ai-scenario.test-support";
import { geminiEmbedding } from "@/modules/ai-assistance/ai-seam.test-support";
import { machineRecord } from "@/modules/collection";
import { reportProblemAndTriageCommand } from "@/modules/repair";
import { executeCommand, journalOf } from "@/platform/command";
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
    expect(rows).toEqual([{ machine_category: "pinball", technology: "solid-state", from_creation: true }]);
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

describe("migrations 0043_file_attachments and 0044_file_owner_dropped", () => {
  /** Files as production had them before the feature `files`: each owned by a machine or a machine model. */
  async function beforeFiles(db: NodePgDatabase) {
    const tom = randomUUID();
    await db.execute(sql`
      INSERT INTO team_member (id, name, email, username, role)
      VALUES (${tom}, 'Tom', 'tom@example.org', 'tom', 'technician')`);
    const model = randomUUID();
    await db.execute(sql`
      INSERT INTO machine_model (id, title, manufacturer, machine_category, technology)
      VALUES (${model}, 'Medieval Madness', 'Williams', 'pinball', 'dmd')`);
    const machine = async (museumNumber: string, retired = false) => {
      const id = randomUUID();
      await db.execute(sql`
        INSERT INTO machine (id, museum_number, machine_model_id, location, machine_status, registered_at, retired_at,
          retired_by, retirement_reason)
        VALUES (${id}, ${museumNumber}, ${model}, 'Hall 1', 'playable', '2026-01-01T10:00:00Z',
          ${retired ? "2026-03-01T00:00:00Z" : null}, ${retired ? tom : null}, ${retired ? "Sold" : null})`);
      return id;
    };
    const file = async (
      title: string,
      owner: { machineId: string } | { machineModelId: string },
      { removed = false, attachedAt = "2026-02-01T10:00:00Z" } = {},
    ) => {
      const id = randomUUID();
      await db.execute(sql`
        INSERT INTO file (id, machine_id, machine_model_id, title, file_category, content, size, content_type,
          attached_by, attached_at, removed_by, removed_at, version)
        VALUES (${id}, ${"machineId" in owner ? owner.machineId : null}, ${"machineModelId" in owner ? owner.machineModelId : null},
          ${title}, 'manual', ${`files/${id}`}, 1000, 'application/pdf', ${tom}, ${attachedAt},
          ${removed ? tom : null}, ${removed ? "2026-04-01T10:00:00Z" : null}, ${removed ? 1 : 0})`);
      return id;
    };
    /** An entry of the AI index as the AI work stored it – copying the file's owner (ST-106). */
    const entry = async (
      fileId: string,
      owner: { machineId: string } | { machineModelId: string },
      { failed = false, embeddingModel = "google/gemini-embedding-001" } = {},
    ) => {
      await db.execute(sql`
        INSERT INTO ai_index_entry (id, machine_id, machine_model_id, state, embedding_model, changed_at, failure_reason,
          pages_indexed, images_indexed, cost)
        VALUES (${fileId}, ${"machineId" in owner ? owner.machineId : null}, ${"machineModelId" in owner ? owner.machineModelId : null},
          ${failed ? "failed" : "indexed"}, ${embeddingModel}, '2026-02-01T11:00:00Z', ${failed ? "unreadable" : null},
          ${failed ? null : 2}, ${failed ? null : 0}, ${failed ? null : 0.01})`);
      if (!failed)
        await db.execute(sql`
          INSERT INTO ai_index_item (id, file_id, kind, page, text, embedding)
          VALUES (${randomUUID()}, ${fileId}, 'passage', 1, 'Replace the left flipper coil', array_fill(0.1, ARRAY[1536])::vector(1536))`);
    };
    return { tom, model, machine, file, entry };
  }

  it("ST-113: Existing files stay where they were and nothing is indexed again", async () => {
    const db = await isolated.reset("0042_yellow_bushwacker");
    const before = await beforeFiles(db);
    const lg042 = await before.machine("LG-042");
    await before.machine("LG-043");
    const lg007 = await before.machine("LG-007", true);
    const manual = await before.file("MM Operations Manual", { machineModelId: before.model });
    const wiring = await before.file("Wiring notes", { machineId: lg042 }, { attachedAt: "2026-02-02T10:00:00Z" });
    await before.file("Old manual", { machineId: lg042 }, { removed: true });
    const unreadable = await before.file("Unreadable scan", { machineModelId: before.model });
    await before.file("Notes of a retired machine", { machineId: lg007 });
    await before.file("Not indexed yet", { machineId: lg042 });
    await before.entry(manual, { machineModelId: before.model });
    await before.entry(wiring, { machineId: lg042 }, { embeddingModel: "openai/text-embedding-3-small" });
    await before.entry(unreadable, { machineModelId: before.model }, { failed: true });
    await db.execute(sql`
      INSERT INTO pending_upload (name, machine_id, machine_model_id, issued_to, issued_at, maximum_size, declared_size)
      VALUES ('files/pending', ${lg042}, null, ${before.tom}, '2026-02-03T10:00:00Z', 100000000, 10)`);
    // Without the owner columns, which migration 0045 drops (ST-120).
    const index = async () =>
      (
        await db.execute(
          sql`SELECT id, state, embedding_model, changed_at, failure_reason, pages_indexed, images_indexed, cost, version FROM ai_index_entry ORDER BY id`,
        )
      ).rows;
    // Every column the items had then – the words of ST-118 (migration 0046) are new and do not change an item.
    const items = async () =>
      (await db.execute(sql`SELECT id, position, file_id, kind, page, text, embedding FROM ai_index_item ORDER BY id`))
        .rows;
    const journal = async () => (await db.execute(sql`SELECT count(*)::int AS count FROM event_journal`)).rows;
    const [indexBefore, itemsBefore, journalBefore] = [await index(), await items(), await journal()];

    await isolated.migrate();

    // The machine records of both machines of the model show the model's manual; only LG-042 shows its own file.
    const titles = async (museumNumber: string) =>
      (await machineRecord(db, museumNumber))!.files.map((file) => file.title).sort();
    expect(await titles("LG-042")).toEqual(
      ["MM Operations Manual", "Not indexed yet", "Unreadable scan", "Wiring notes"].sort(),
    );
    expect(await titles("LG-043")).toEqual(["MM Operations Manual", "Unreadable scan"]);
    expect(
      (await machineRecord(db, "LG-042"))!.files.find((file) => file.title === "MM Operations Manual"),
    ).toMatchObject({ ofMachineModel: true });
    // A retired machine keeps its file's attachment, a removed file keeps its attachment too (it counts for nothing).
    const attachments = await db.execute<{ title: string; machine_id: string | null; machine_model_id: string | null }>(
      sql`SELECT f.title, a.machine_id, a.machine_model_id FROM file_attachment a JOIN file f ON f.id = a.file_id ORDER BY a.position`,
    );
    expect(attachments.rows).toHaveLength(6);
    expect(attachments.rows.find((row) => row.title === "Notes of a retired machine")).toMatchObject({
      machine_id: lg007,
    });
    expect(attachments.rows.find((row) => row.title === "Old manual")).toMatchObject({ machine_id: lg042 });
    expect(attachments.rows.find((row) => row.title === "MM Operations Manual")).toMatchObject({
      machine_id: null,
      machine_model_id: before.model,
    });
    // "Attached by" and "attached at" are now "added by" and "added at"; there is no original file name.
    const added = await db.execute(
      sql`SELECT added_by, added_at = '2026-02-02T10:00:00Z'::timestamptz AS added_when_attached, original_file_name, removed_at IS NOT NULL AS removed FROM file WHERE id = ${wiring}`,
    );
    expect(added.rows).toEqual([
      { added_by: before.tom, added_when_attached: true, original_file_name: null, removed: false },
    ]);
    // The AI index is untouched – the same entries and items, an entry of an old embedding model and a failed one included –
    // and the migration wrote no journal entry and asked no AI (it is SQL), so no file became waiting that was not.
    expect(await index()).toEqual(indexBefore);
    expect(await items()).toEqual(itemsBefore);
    expect(await journal()).toEqual(journalBefore);
    expect((await index()).filter((row) => (row as { state: string }).state === "indexed")).toHaveLength(2);
    // A pending upload loses its machine and keeps its team member.
    const pending = await db.execute(sql`SELECT name, issued_to FROM pending_upload`);
    expect(pending.rows).toEqual([{ name: "files/pending", issued_to: before.tom }]);
    const columns = await db.execute(
      sql`SELECT column_name FROM information_schema.columns WHERE table_name IN ('file', 'pending_upload') AND column_name IN ('machine_id', 'machine_model_id', 'attached_by', 'attached_at')`,
    );
    expect(columns.rows).toEqual([]);
  });
});

describe("migration 0045_ai_index_entry_owner_dropped", () => {
  const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
  const clock = fixedClock("2026-11-04T10:00:00Z");

  it("ST-120: The AI index stays whole when its entries lose their machine", async () => {
    const db = await isolated.reset("0044_file_owner_dropped");
    await db.execute(sql`
      INSERT INTO team_member (id, name, email, username, role)
      VALUES (${tom.teamMemberId}, 'Tom', 'tom@example.org', 'tom', 'technician')`);
    const model = randomUUID();
    await db.execute(sql`
      INSERT INTO machine_model (id, title, manufacturer, machine_category, technology)
      VALUES (${model}, 'Medieval Madness', 'Williams', 'pinball', 'dmd')`);
    const lg042 = randomUUID();
    await db.execute(sql`
      INSERT INTO machine (id, museum_number, machine_model_id, location, machine_status, registered_at)
      VALUES (${lg042}, 'LG-042', ${model}, 'Hall 1', 'playable', '2026-01-01T10:00:00Z')`);
    /** A file with its one attachment, as ST-113 left it. */
    const file = async (title: string, owner: { machineId: string } | { machineModelId: string }) => {
      const id = randomUUID();
      await db.execute(sql`
        INSERT INTO file (id, title, file_category, content, size, content_type, added_by, added_at, version)
        VALUES (${id}, ${title}, 'manual', ${`files/${id}`}, 1000, 'application/pdf', ${tom.teamMemberId}, '2026-02-01T10:00:00Z', 0)`);
      await db.execute(sql`
        INSERT INTO file_attachment (id, file_id, machine_id, machine_model_id)
        VALUES (${randomUUID()}, ${id}, ${"machineId" in owner ? owner.machineId : null},
          ${"machineModelId" in owner ? owner.machineModelId : null})`);
      return id;
    };
    /** An entry of the AI index as the AI work stored it – copying the file's owner (ST-106). */
    const entry = async (
      fileId: string,
      owner: { machineId: string } | { machineModelId: string },
      { failed, embeddingModel = geminiEmbedding.id }: { failed?: string; embeddingModel?: string } = {},
    ) => {
      await db.execute(sql`
        INSERT INTO ai_index_entry (id, machine_id, machine_model_id, state, embedding_model, changed_at, failure_reason,
          pages_indexed, images_indexed, cost)
        VALUES (${fileId}, ${"machineId" in owner ? owner.machineId : null}, ${"machineModelId" in owner ? owner.machineModelId : null},
          ${failed ? "failed" : "indexed"}, ${embeddingModel}, '2026-02-01T11:00:00Z', ${failed ?? null},
          ${failed ? null : 1}, ${failed ? null : 1}, ${failed ? null : 0.01})`);
      if (!failed)
        await db.execute(sql`
          INSERT INTO ai_index_item (id, file_id, kind, page, text, embedding)
          VALUES (${randomUUID()}, ${fileId}, 'passage', 1, 'Replace the left flipper coil', array_fill(0.1, ARRAY[1536])::vector(1536))`);
    };
    const manual = await file("MM Operations Manual", { machineModelId: model });
    await file("Wiring notes", { machineId: lg042 });
    const attract = await file("Attract mode.mp4", { machineId: lg042 });
    const oldScan = await file("Old scan", { machineId: lg042 });
    await entry(manual, { machineModelId: model });
    await entry(attract, { machineId: lg042 }, { failed: "format not indexed" });
    await entry(oldScan, { machineId: lg042 }, { embeddingModel: "openai/text-embedding-3-small" });
    const scenario = aiScenario({ db: () => db, clock, technician: tom });
    await scenario.turnAiOn();
    const before = await aiIndexOverview(db, scenario.ai());
    const openRouter = scenario.openRouter();

    await isolated.migrate();

    const after = await aiIndexOverview(db, scenario.ai(openRouter));
    expect(after).toEqual(before);
    expect(after).toMatchObject({
      indexed: 1,
      waiting: 2,
      failed: [{ fileId: attract, title: "Attract mode.mp4", reason: "format not indexed" }],
    });
    expect(openRouter.requests).toEqual([]);
    expect(openRouter.chatRequests).toEqual([]);
    // An AI assessment of a defect of LG-042, which the manual's machine model is attached to, finds it.
    const reported = await executeCommand(
      reportProblemAndTriageCommand,
      {
        machineId: lg042,
        description: "Left flipper weak",
        triage: {
          outcome: "defect-recorded",
          title: "Left flipper weak",
          priority: undefined,
          suitableForHelpers: false,
          machineStatus: undefined,
          machineVersion: undefined,
        },
      },
      { actor: tom, db, clock, newId: randomUUID },
    );
    if (!reported.ok || !reported.result.defectId) throw new Error("no defect recorded");
    const id = await scenario.requestAiAssessment(reported.result.defectId);
    await scenario.run({ kinds: [aiAssessmentWork] });
    const written = (await journalOf(db, { aggregateId: id })).find((each) => each.type === "EVT-AiAssessmentWritten");
    expect(written?.data.filesSearched).toEqual([manual]);
  });
});

describe("migration 0046_file_content_words", () => {
  const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
  const clock = fixedClock("2026-11-06T10:00:00Z");

  it("a passage indexed before the search was built is searchable by its words as soon as the migration has run (ST-118)", async () => {
    const db = await isolated.reset("0045_ai_index_entry_owner_dropped");
    await db.execute(sql`
      INSERT INTO team_member (id, name, email, username, role)
      VALUES (${tom.teamMemberId}, 'Tom', 'tom@example.org', 'tom', 'technician')`);
    const fileId = randomUUID();
    await db.execute(sql`
      INSERT INTO file (id, title, file_category, content, size, content_type, added_by, added_at, version)
      VALUES (${fileId}, 'Backbox schematic', 'schematic', ${`files/${fileId}`}, 1000, 'application/pdf', ${tom.teamMemberId}, '2026-02-01T10:00:00Z', 0)`);
    await db.execute(sql`
      INSERT INTO ai_index_entry (id, state, embedding_model, changed_at, pages_indexed, images_indexed, cost, version)
      VALUES (${fileId}, 'indexed', 'openai/text-embedding-3-small', '2026-02-02T10:00:00Z', 12, 12, 0.01, 0)`);
    await db.execute(sql`
      INSERT INTO ai_index_item (id, file_id, kind, page, text, embedding)
      VALUES (${randomUUID()}, ${fileId}, 'passage', 12, 'Auf Seite 12 sitzen die Spulen.', array_fill(0.1, ARRAY[1536])::vector(1536))`);
    const scenario = aiScenario({ db: () => db, clock, technician: tom });
    const openRouter = scenario.openRouter();
    const before = await aiIndexOverview(db, scenario.ai(openRouter));

    await isolated.migrate();

    // The words are there as soon as the migration has run: German and English forms, any embedding model, AI off.
    expect((await filesContainingWords(db, ["spule"]))[0]?.has(fileId)).toBe(true);
    expect((await filesContainingWords(db, ["seite", "zylinderkopf"]))[1]?.has(fileId)).toBe(false);
    expect(await aiIndexOverview(db, scenario.ai(openRouter))).toEqual(before);
    expect(openRouter.requests).toEqual([]);
  });
});
