import { eq, inArray, and } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import type { Database } from "../database";

/**
 * Histories are append-only lists (architecture review 2026-09-27, Q13; ST-012): a history – the machine status
 * history, a work log, defect resolutions – is a list in the aggregate's state, and every entry carries an ID from
 * the command's ID generator. Saving inserts the entries not stored yet, recognised by that ID, and never changes or
 * deletes a stored one – whatever the state says about it.
 */
export type History<T extends PgTable & { id: PgColumn }> = {
  table: T;
  /** The column naming the aggregate the entries belong to. */
  owner: PgColumn;
};

export async function saveHistory<T extends PgTable & { id: PgColumn }>(
  tx: Database,
  { table, owner }: History<T>,
  ownerId: string,
  entries: (T["$inferInsert"] & { id: string })[],
): Promise<void> {
  if (entries.length === 0) return;
  const stored = await tx
    .select({ id: table.id })
    .from(table as PgTable)
    .where(
      and(
        eq(owner, ownerId),
        inArray(
          table.id,
          entries.map((entry) => entry.id),
        ),
      ),
    );
  const storedIds = new Set(stored.map((row) => row.id as string));
  const added = entries.filter((entry) => !storedIds.has(entry.id));
  if (added.length > 0) await tx.insert(table).values(added as never);
}
