import { asc, eq, inArray } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import type { Database } from "../database";
import type { StoredList } from "./stored-list";

/**
 * A list an aggregate holds and replaces as a whole (ST-106 – the passages, page images and images of an AI index
 * entry): a list in the aggregate's state, every entry with an ID from the command's ID generator. A history only adds
 * and a list of entities only changes in place; this one is saved by removing everything stored for the aggregate and
 * inserting the state's entries – an aggregate that is replaced as a whole never keeps a mix of two saves.
 *
 * A module describes such a list once with `replaces({ … })` and names it in its `aggregateStore` under `replaces` –
 * the store loads it into the state and saves it with the aggregate, in the order the entries were stored.
 */

/** A table of such a list: its own `id` (the entry's ID, no database default) and a `position bigserial`. */
type ReplaceTable = PgTable & { id: PgColumn; position: PgColumn };

/** How one list an aggregate replaces as a whole is stored. */
export type Replaces<Entry extends { id: string }> = StoredList<Entry> & {
  /** Removes what is stored and inserts the state's entries – nothing of an earlier save stays. */
  readonly kind: "replaces";
};

export function replaces<
  T extends ReplaceTable,
  Owner extends keyof T["$inferInsert"] & keyof T["$inferSelect"] & keyof T,
  Entry extends { id: string },
>(definition: {
  table: T;
  /** The column that holds the owning aggregate's ID – the list fills it in itself. */
  owner: Owner;
  toEntry: (row: T["$inferSelect"]) => Entry;
  /** The row without its owner and position. */
  toRow: (entry: Entry) => Omit<T["$inferInsert"], Owner | "position">;
}): Replaces<Entry> {
  const { table, owner, toEntry, toRow } = definition;
  const ownerColumn = table[owner] as PgColumn;
  return {
    kind: "replaces",
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
    async save(tx: Database, aggregateId, entries) {
      await tx.delete(table).where(eq(ownerColumn, aggregateId));
      if (entries.length === 0) return;
      await tx.insert(table).values(entries.map((entry) => ({ ...toRow(entry), [owner]: aggregateId })) as never);
    },
  };
}
