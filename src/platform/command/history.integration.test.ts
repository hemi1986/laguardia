import { randomUUID } from "node:crypto";
import { asc, eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { bigserial, integer, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fixedClock } from "@/platform/clock";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { anExistingTeamMember } from "@/test-support/team-members";
import { aggregateCommand, aggregateStore, executeCommand, history, type Database } from ".";

/**
 * Histories are append-only lists (architecture review 2026-09-27, Q13; ST-012): a stand-in aggregate whose store
 * names a history (architecture review 2026-10-11), with tables that exist only in this test's own database. A trigger refuses every UPDATE of a history entry, so a save
 * that touched a stored entry would fail the command.
 */
const isolated = isolatedTestDatabase("history");
let db: NodePgDatabase;
const technician = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;

const logbook = pgTable("test_logbook", {
  id: uuid("id").primaryKey(),
  version: integer("version").notNull().default(0),
});
const logbookEntry = pgTable("test_logbook_entry", {
  id: uuid("id").primaryKey(),
  position: bigserial("position", { mode: "number" }).notNull(),
  logbookId: uuid("logbook_id").notNull(),
  note: text("note").notNull(),
});

type Entry = { id: string; note: string };
type Logbook = { id: string; entries: Entry[] };

const entries = history({
  table: logbookEntry,
  owner: "logbookId",
  toEntry: (row): Entry => ({ id: row.id, note: row.note }),
  toRow: (entry) => entry,
});

const logbooks = aggregateStore({
  type: "AGG-TestLogbook",
  table: logbook,
  histories: { entries },
  toState: (row, histories): Logbook => ({ id: row.id, entries: histories.entries }),
  toRow: (state: Logbook) => ({ id: state.id }),
});

/** The stored entries, read past the store – the oldest first. */
async function entriesOf(tx: Database, logbookId: string): Promise<Entry[]> {
  return tx
    .select({ id: logbookEntry.id, note: logbookEntry.note })
    .from(logbookEntry)
    .where(eq(logbookEntry.logbookId, logbookId))
    .orderBy(asc(logbookEntry.position));
}

const journal = (_event: { type: "EVT-TestNoteWritten" }, state: Logbook) => ({
  type: "EVT-TestNoteWritten" as const,
  aggregate: { type: "AGG-TestLogbook" as const, id: state.id },
  machineId: null,
  data: {},
});

const openLogbook = aggregateCommand({
  id: "CMD-TestOpenLogbook",
  allowedActors: ["technician"],
  store: logbooks,
  creates: true,
  decide: (_nothing: undefined, input: { note: string }, { newId }) => ({
    ok: true as const,
    state: { id: newId(), entries: [{ id: newId(), note: input.note }] },
    events: [{ type: "EVT-TestNoteWritten" as const }],
  }),
  journal,
  result: (state) => ({ logbookId: state.id }),
});

/** Adds an entry – and, as a careless decision might, also rewrites the first one in the state it returns. */
const writeNote = aggregateCommand({
  id: "CMD-TestWriteNote",
  allowedActors: ["technician"],
  store: logbooks,
  target: (input: { logbookId: string; version: number; note: string }) => ({
    id: input.logbookId,
    version: input.version,
  }),
  decide: (state, input, { newId }) => ({
    ok: true as const,
    state: {
      ...state,
      entries: [
        ...state.entries.map((entry, index) => (index === 0 ? { ...entry, note: "rewritten" } : entry)),
        { id: newId(), note: input.note },
      ],
    },
    events: [{ type: "EVT-TestNoteWritten" as const }],
  }),
  journal,
  result: () => ({}),
});

beforeAll(async () => {
  db = await isolated.reset();
  await anExistingTeamMember(db, technician);
  await db.execute(sql`
    CREATE TABLE test_logbook (id uuid PRIMARY KEY, version integer NOT NULL DEFAULT 0);
    CREATE TABLE test_logbook_entry (
      id uuid PRIMARY KEY, position bigserial NOT NULL, logbook_id uuid NOT NULL REFERENCES test_logbook(id), note text NOT NULL
    );
    CREATE FUNCTION test_refuse_update() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'a history entry is never updated'; END $$;
    CREATE TRIGGER test_logbook_entry_insert_only BEFORE UPDATE ON test_logbook_entry
      FOR EACH ROW EXECUTE FUNCTION test_refuse_update();
  `);
});

afterAll(() => isolated.close());

describe("an aggregate store with a history", () => {
  it("stores the entries two commands add, keeps the first unchanged and never updates an entry present at load", async () => {
    const dependencies = { actor: technician, db, clock: fixedClock("2026-10-03T10:00:00Z"), newId: randomUUID };
    const opened = await executeCommand(openLogbook, { note: "first" }, dependencies);
    if (!opened.ok) throw new Error(opened.error);
    const { logbookId } = opened.result;

    const written = await executeCommand(writeNote, { logbookId, version: 0, note: "second" }, dependencies);

    expect(written).toEqual({ ok: true, result: {} });
    expect((await entriesOf(db, logbookId)).map((entry) => entry.note)).toEqual(["first", "second"]);
  });
});

describe("the latest entries of a history (architecture review 2026-10-30)", () => {
  it("reads only the newest entries, the newest first, and how many there are in all", async () => {
    const dependencies = { actor: technician, db, clock: fixedClock("2026-10-03T10:00:00Z"), newId: randomUUID };
    const opened = await executeCommand(openLogbook, { note: "1" }, dependencies);
    if (!opened.ok) throw new Error(opened.error);
    const { logbookId } = opened.result;
    for (const [version, note] of ["2", "3", "4"].entries()) {
      const written = await executeCommand(writeNote, { logbookId, version, note }, dependencies);
      if (!written.ok) throw new Error(written.error);
    }
    const other = await executeCommand(openLogbook, { note: "elsewhere" }, dependencies);
    if (!other.ok) throw new Error(other.error);

    const latest = await entries.latest(db, logbookId, 2);

    expect({ ...latest, latest: latest.latest.map((entry) => entry.note) }).toEqual({ latest: ["4", "3"], total: 4 });
    expect(await entries.latest(db, randomUUID(), 2)).toEqual({ latest: [], total: 0 });
  });
});
