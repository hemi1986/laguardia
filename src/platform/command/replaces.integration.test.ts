import { randomUUID } from "node:crypto";
import { asc, eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { bigserial, integer, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { aggregateCommand, aggregateStore, executeCommand, replaces, type Database } from ".";

/**
 * The three command-layer capabilities ST-106 introduced, proven on a stand-in aggregate of their own (the seam
 * catalog keeps the command layer's proofs here, next to `history` and `entities`): a list the aggregate replaces as a
 * whole, a store whose creating command replaces its row, and a command that removes its aggregate.
 */
const isolated = isolatedTestDatabase("replaces");
let db: NodePgDatabase;
const technician = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const asTechnician = () => ({
  actor: technician,
  db,
  clock: { now: () => new Date("2026-11-02T10:00:00Z") },
  newId: randomUUID,
});

const basket = pgTable("test_basket", {
  id: uuid("id").primaryKey(),
  version: integer("version").notNull().default(0),
});
const basketItem = pgTable("test_basket_item", {
  id: uuid("id").primaryKey(),
  position: bigserial("position", { mode: "number" }).notNull(),
  basketId: uuid("basket_id")
    .notNull()
    .references(() => basket.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
});

type Item = { id: string; label: string };
type Basket = { id: string; items: Item[] };

const items = replaces({
  table: basketItem,
  owner: "basketId",
  toEntry: (row): Item => ({ id: row.id, label: row.label }),
  toRow: (item) => item,
});

const baskets = aggregateStore({
  type: "AGG-TestBasket",
  table: basket,
  insertReplaces: true,
  replaces: { items },
  toState: (row, lists): Basket => ({ id: row.id, items: lists.items }),
  toRow: (state: Basket) => ({ id: state.id }),
});

const journal = (_event: { type: "EVT-TestBasketChanged" }, state: Basket) => ({
  type: "EVT-TestBasketChanged" as const,
  aggregate: { type: "AGG-TestBasket" as const, id: state.id },
  machineId: null,
  data: {},
});

/** A creating command whose identity comes from outside – it fills the basket or replaces what it held. */
const fill = aggregateCommand({
  id: "CMD-TestFillBasket",
  allowedActors: ["technician"],
  store: baskets,
  creates: true,
  decide: (_nothing: undefined, input: { basketId: string; labels: string[] }, { newId }) => ({
    ok: true as const,
    state: { id: input.basketId, items: input.labels.map((label) => ({ id: newId(), label })) },
    events: [{ type: "EVT-TestBasketChanged" as const }],
  }),
  journal,
  result: () => ({}),
});

/** A changing command that ends the aggregate – and so its replaced list. */
const empty = aggregateCommand({
  id: "CMD-TestEmptyBasket",
  allowedActors: ["technician"],
  store: baskets,
  target: (input: { basketId: string; version: number }) => ({ id: input.basketId, version: input.version }),
  decide: (state) => ({ ok: true as const, state, events: [{ type: "EVT-TestBasketChanged" as const }] }),
  removes: () => true,
  journal,
  result: () => ({}),
});

async function labelsOf(tx: Database, basketId: string): Promise<string[]> {
  const rows = await tx
    .select({ label: basketItem.label })
    .from(basketItem)
    .where(eq(basketItem.basketId, basketId))
    .orderBy(asc(basketItem.position));
  return rows.map((row) => row.label);
}

const rowExists = async (basketId: string) =>
  (await db.select({ id: basket.id }).from(basket).where(eq(basket.id, basketId))).length > 0;

const versionOf = async (basketId: string) =>
  (await db.select({ version: basket.version }).from(basket).where(eq(basket.id, basketId)))[0]?.version;

beforeAll(async () => {
  db = await isolated.reset();
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS test_basket (
      id uuid PRIMARY KEY,
      version integer NOT NULL DEFAULT 0
    )`);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS test_basket_item (
      id uuid PRIMARY KEY,
      position bigserial NOT NULL,
      basket_id uuid NOT NULL REFERENCES test_basket(id) ON DELETE CASCADE,
      label text NOT NULL
    )`);
});
afterAll(() => isolated.close());
beforeEach(async () => {
  await db.execute(sql`TRUNCATE test_basket, test_basket_item`);
});

describe("a replaced list", () => {
  it("a creating command inserts the row once and replaces it with everything it holds on the next run", async () => {
    const basketId = randomUUID();

    expect(await executeCommand(fill, { basketId, labels: ["apple", "pear"] }, asTechnician())).toMatchObject({ ok: true });
    expect(await labelsOf(db, basketId)).toEqual(["apple", "pear"]);
    expect(await versionOf(basketId)).toBe(0);

    expect(await executeCommand(fill, { basketId, labels: ["plum"] }, asTechnician())).toMatchObject({ ok: true });
    // Replaced as a whole: the items of the first run are gone, the version counts on as a change would.
    expect(await labelsOf(db, basketId)).toEqual(["plum"]);
    expect(await versionOf(basketId)).toBe(1);
  });

  it("a failed state holds none of the list – everything stored before is gone", async () => {
    const basketId = randomUUID();
    await executeCommand(fill, { basketId, labels: ["apple", "pear"] }, asTechnician());

    // The same command with no items – what a failed AI index entry is.
    expect(await executeCommand(fill, { basketId, labels: [] }, asTechnician())).toMatchObject({ ok: true });

    expect(await labelsOf(db, basketId)).toEqual([]);
  });
});

describe("a command that removes its aggregate", () => {
  it("deletes the row, its replaced list and records its event", async () => {
    const basketId = randomUUID();
    await executeCommand(fill, { basketId, labels: ["apple"] }, asTechnician());

    expect(await executeCommand(empty, { basketId, version: 0 }, asTechnician())).toMatchObject({ ok: true });

    expect(await rowExists(basketId)).toBe(false);
    expect(await labelsOf(db, basketId)).toEqual([]);
  });

  it("is rejected for a missing aggregate like any changing command", async () => {
    expect(await executeCommand(empty, { basketId: randomUUID(), version: 0 }, asTechnician())).toEqual({
      ok: false,
      error: "not-found",
    });
  });
});
