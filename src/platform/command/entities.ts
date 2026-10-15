import { and, eq, inArray } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import { history, type History } from "./history";

/**
 * A list of entities that are changed but never deleted (ST-040 – the maintenance tasks of the maintenance plan): a
 * list in the aggregate's state, every entity with an ID from the command's ID generator. Unlike a history (Q13), a
 * stored entity is changed in place when the state changes it; like a history, nothing is ever deleted – an entity
 * that ends is marked so in its own columns (a removed maintenance task keeps `removedAt`, ST-041), and one the state
 * leaves out stays stored as it was.
 *
 * A module describes such a list once with `entities({ … })` and names it in its `aggregateStore` under `entities` –
 * the store loads it into the state, in the order the entities were added, and saves it with the aggregate.
 */

/** A table of such a list: its own `id` (the entity's ID, no database default) and a `position bigserial`. */
type EntityTable = PgTable & { id: PgColumn; position: PgColumn };

/** How one list of entities of an aggregate is stored – loaded and saved like a history, saved differently. */
export type Entities<Entity extends { id: string }> = History<Entity>;

export function entities<
  T extends EntityTable,
  Owner extends keyof T["$inferInsert"] & keyof T["$inferSelect"] & keyof T,
  Entity extends { id: string },
>(definition: {
  table: T;
  /** The column that holds the owning aggregate's ID – the list fills it in itself. */
  owner: Owner;
  toEntity: (row: T["$inferSelect"]) => Entity;
  /** The row without its owner and position. */
  toRow: (entity: Entity) => Omit<T["$inferInsert"], Owner | "position">;
}): Entities<Entity> {
  const { table, owner, toEntity, toRow } = definition;
  const ownerColumn = table[owner] as PgColumn;
  // Loaded exactly like a history – in the order the entities were added.
  const { load } = history({ table, owner, toEntry: toEntity, toRow });
  return {
    load,
    async save(tx, aggregateId, list) {
      if (list.length === 0) return;
      const stored = await tx
        .select({ id: table.id })
        .from(table as PgTable)
        .where(
          and(
            eq(ownerColumn, aggregateId),
            inArray(
              table.id,
              list.map((entity) => entity.id),
            ),
          ),
        );
      const storedIds = new Set(stored.map((row) => row.id as string));
      const added = list
        .filter((entity) => !storedIds.has(entity.id))
        .map((entity) => ({ ...toRow(entity), [owner]: aggregateId }));
      if (added.length > 0) await tx.insert(table).values(added as never);
      for (const entity of list.filter((candidate) => storedIds.has(candidate.id))) {
        await tx
          .update(table)
          .set(toRow(entity) as never)
          .where(and(eq(table.id, entity.id), eq(ownerColumn, aggregateId)));
      }
    },
  };
}
