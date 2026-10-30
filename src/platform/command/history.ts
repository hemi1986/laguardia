import { and, asc, count, desc, eq, inArray } from "drizzle-orm";
import type { Database } from "../database";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import type { StoredList } from "./stored-list";

/**
 * Histories are append-only lists (architecture review 2026-09-27, Q13; ST-012): a history – the machine status
 * history, a work log, defect resolutions – is a list in the aggregate's state, and every entry carries an ID from the
 * command's ID generator. Saving inserts the entries not stored yet, recognised by that ID, and never changes or
 * deletes a stored one – whatever the state says about it. So a fact that comes later (a defect reopened after its
 * resolution) is an entry of its own, never a change of a stored one (architecture review 2026-10-11).
 *
 * A module describes a history once with `history({ … })` and names it in its `aggregateStore` – the store loads it
 * into the state and saves it with the aggregate; read models load it through the same description, for many
 * aggregates in one query.
 */

/** A history table: its own `id` (the entry's ID, no database default) and a `position bigserial` for the order. */
type HistoryTable = PgTable & { id: PgColumn; position: PgColumn };

/**
 * The latest entries of a list, the newest first, and how many it has in all – what a record shows of a history before
 * „Alle … (n)“ leads to the rest (G24, architecture review 2026-10-30).
 */
export type Latest<Entry> = { latest: Entry[]; total: number };

/** How one history of an aggregate is stored. */
export type History<Entry extends { id: string }> = StoredList<Entry> & {
  /** Inserts the entries not stored yet; a stored entry is never updated or deleted. */
  readonly kind: "history";
  /** The aggregate's `count` newest entries, the newest first, and how many it has – only those are read. */
  latest(db: Database, aggregateId: string, count: number): Promise<Latest<Entry>>;
};

export function history<
  T extends HistoryTable,
  Owner extends keyof T["$inferInsert"] & keyof T["$inferSelect"] & keyof T,
  Entry extends { id: string },
>(definition: {
  table: T;
  /** The column that holds the owning aggregate's ID – the history fills it in itself. */
  owner: Owner;
  toEntry: (row: T["$inferSelect"]) => Entry;
  /** The row without its owner and position. */
  toRow: (entry: Entry) => Omit<T["$inferInsert"], Owner | "position">;
}): History<Entry> {
  const { table, owner, toEntry, toRow } = definition;
  const ownerColumn = table[owner] as PgColumn;
  return {
    kind: "history",
    async load(db, aggregateIds) {
      const byAggregate = new Map<string, Entry[]>();
      if (aggregateIds.length === 0) return byAggregate;
      const rows = await db
        .select()
        .from(table as PgTable)
        .where(inArray(ownerColumn, [...aggregateIds]))
        .orderBy(asc(table.position));
      for (const row of rows as T["$inferSelect"][]) {
        const aggregateId = row[owner] as string;
        byAggregate.set(aggregateId, [...(byAggregate.get(aggregateId) ?? []), toEntry(row)]);
      }
      return byAggregate;
    },
    async latest(db, aggregateId, newest) {
      const [rows, [{ total }]] = await Promise.all([
        db
          .select()
          .from(table as PgTable)
          .where(eq(ownerColumn, aggregateId))
          .orderBy(desc(table.position))
          .limit(newest),
        db
          .select({ total: count() })
          .from(table as PgTable)
          .where(eq(ownerColumn, aggregateId)),
      ]);
      return { latest: (rows as T["$inferSelect"][]).map(toEntry), total };
    },
    async save(tx, aggregateId, entries) {
      if (entries.length === 0) return;
      const stored = await tx
        .select({ id: table.id })
        .from(table as PgTable)
        .where(
          and(
            eq(ownerColumn, aggregateId),
            inArray(
              table.id,
              entries.map((entry) => entry.id),
            ),
          ),
        );
      const storedIds = new Set(stored.map((row) => row.id as string));
      const added = entries
        .filter((entry) => !storedIds.has(entry.id))
        .map((entry) => ({ ...toRow(entry), [owner]: aggregateId }));
      if (added.length > 0) await tx.insert(table).values(added as never);
    },
  };
}
