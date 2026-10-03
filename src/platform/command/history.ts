import { and, eq, inArray } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import type { Database } from "../database";

/**
 * Histories are append-only lists (architecture review 2026-09-27, Q13; ST-012): a history – the machine status
 * history, a work log, defect resolutions – is a list in the aggregate's state, and every entry carries an ID from
 * the command's ID generator. Saving inserts the entries not stored yet, recognised by that ID, and never changes or
 * deletes a stored one – whatever the state says about it.
 */
type HistoryTable = PgTable & { id: PgColumn };

/** A history table and the name of its column that holds the owning aggregate's ID. */
export type History<T extends HistoryTable, Owner extends keyof T["$inferInsert"] & keyof T> = {
  table: T;
  owner: Owner;
};

/** Saves the history of the aggregate `ownerId`; the helper fills in the owner column of every entry itself. */
export async function saveHistory<T extends HistoryTable, Owner extends keyof T["$inferInsert"] & keyof T>(
  tx: Database,
  { table, owner }: History<T, Owner>,
  ownerId: string,
  entries: (Omit<T["$inferInsert"], Owner> & { id: string })[],
): Promise<void> {
  if (entries.length === 0) return;
  const ownerColumn = table[owner] as PgColumn;
  const stored = await tx
    .select({ id: table.id })
    .from(table as PgTable)
    .where(
      and(
        eq(ownerColumn, ownerId),
        inArray(
          table.id,
          entries.map((entry) => entry.id),
        ),
      ),
    );
  const storedIds = new Set(stored.map((row) => row.id as string));
  const added = entries.filter((entry) => !storedIds.has(entry.id)).map((entry) => ({ ...entry, [owner]: ownerId }));
  if (added.length > 0) await tx.insert(table).values(added as never);
}
