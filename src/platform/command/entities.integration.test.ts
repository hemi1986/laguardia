import { randomUUID } from "node:crypto";
import { asc, eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { bigserial, integer, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fixedClock } from "@/platform/clock";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { anExistingTeamMember } from "@/test-support/team-members";
import { aggregateCommand, aggregateStore, entities, executeCommand, type Database } from ".";

/**
 * A list of entities that are changed but never deleted (ST-040 – the maintenance tasks of the maintenance plan; the
 * engineering conventions: "a list whose entries are changed is not a history"): a stand-in aggregate whose store names
 * such a list, with tables that exist only in this test's own database. A trigger refuses every DELETE of an entry, so
 * a save that removed one would fail the command.
 */
const isolated = isolatedTestDatabase("entities");
let db: NodePgDatabase;
const technician = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;

const shelf = pgTable("test_shelf", {
  id: uuid("id").primaryKey(),
  version: integer("version").notNull().default(0),
});
const shelfItem = pgTable("test_shelf_item", {
  id: uuid("id").primaryKey(),
  position: bigserial("position", { mode: "number" }).notNull(),
  shelfId: uuid("shelf_id").notNull(),
  label: text("label").notNull(),
});

type Item = { id: string; label: string };
type Shelf = { id: string; items: Item[] };

const items = entities({
  table: shelfItem,
  owner: "shelfId",
  toEntity: (row): Item => ({ id: row.id, label: row.label }),
  toRow: (item) => item,
});

const shelves = aggregateStore({
  type: "AGG-TestShelf",
  table: shelf,
  entities: { items },
  toState: (row, lists): Shelf => ({ id: row.id, items: lists.items }),
  toRow: (state: Shelf) => ({ id: state.id }),
});

/** The stored items, read past the store – in the order they were added. */
async function itemsOf(tx: Database, shelfId: string): Promise<string[]> {
  const rows = await tx
    .select({ label: shelfItem.label })
    .from(shelfItem)
    .where(eq(shelfItem.shelfId, shelfId))
    .orderBy(asc(shelfItem.position));
  return rows.map((row) => row.label);
}

const journal = (_event: { type: "EVT-TestShelfChanged" }, state: Shelf) => ({
  type: "EVT-TestShelfChanged" as const,
  aggregate: { type: "AGG-TestShelf" as const, id: state.id },
  machineId: null,
  data: {},
});

const setUpShelf = aggregateCommand({
  id: "CMD-TestSetUpShelf",
  allowedActors: ["technician"],
  store: shelves,
  creates: true,
  decide: (_nothing: undefined, input: { labels: string[] }, { newId }) => ({
    ok: true as const,
    state: { id: newId(), items: input.labels.map((label) => ({ id: newId(), label })) },
    events: [{ type: "EVT-TestShelfChanged" as const }],
  }),
  journal,
  result: (state) => ({ shelfId: state.id }),
});

/** Relabels the first item, adds one – and, as a careless decision might, leaves the second out of the state. */
const rearrange = aggregateCommand({
  id: "CMD-TestRearrangeShelf",
  allowedActors: ["technician"],
  store: shelves,
  target: (input: { shelfId: string; version: number }) => ({ id: input.shelfId, version: input.version }),
  decide: (state, _input, { newId }) => ({
    ok: true as const,
    state: {
      ...state,
      items: [{ ...state.items[0], label: "relabelled" }, ...state.items.slice(2), { id: newId(), label: "added" }],
    },
    events: [{ type: "EVT-TestShelfChanged" as const }],
  }),
  journal,
  result: () => ({}),
});

beforeAll(async () => {
  db = await isolated.reset();
  await anExistingTeamMember(db, technician);
  await db.execute(sql`
    CREATE TABLE test_shelf (id uuid PRIMARY KEY, version integer NOT NULL DEFAULT 0);
    CREATE TABLE test_shelf_item (
      id uuid PRIMARY KEY, position bigserial NOT NULL, shelf_id uuid NOT NULL REFERENCES test_shelf(id), label text NOT NULL
    );
    CREATE FUNCTION test_refuse_delete() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'an entity of the list is never deleted'; END $$;
    CREATE TRIGGER test_shelf_item_never_deleted BEFORE DELETE ON test_shelf_item
      FOR EACH ROW EXECUTE FUNCTION test_refuse_delete();
  `);
});

afterAll(() => isolated.close());

describe("an aggregate store with a list of entities", () => {
  it("adds new entities, changes stored ones in place and never deletes one the state leaves out", async () => {
    const dependencies = { actor: technician, db, clock: fixedClock("2026-10-15T10:00:00Z"), newId: randomUUID };
    const setUp = await executeCommand(setUpShelf, { labels: ["first", "second", "third"] }, dependencies);
    if (!setUp.ok) throw new Error(setUp.error);
    const { shelfId } = setUp.result;

    expect(await executeCommand(rearrange, { shelfId, version: 0 }, dependencies)).toEqual({ ok: true, result: {} });

    // The first changed where it stood, the second kept although the state left it out, the new one last.
    expect(await itemsOf(db, shelfId)).toEqual(["relabelled", "second", "third", "added"]);
    expect((await shelves.load(db, shelfId))?.state.items.map((item) => item.label)).toEqual([
      "relabelled",
      "second",
      "third",
      "added",
    ]);
  });
});
