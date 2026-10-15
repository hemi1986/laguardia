import type { Database } from "../database";

/**
 * How one list inside an aggregate's state is stored – a history (`history`, entries only added) or a list of entities
 * (`entities`, changed in place). The store loads and saves both alike; each kind decides what saving means, and says
 * so in its own type.
 */
export type StoredList<Entry extends { id: string }> = {
  /** The entries of the given aggregates, in the order they were stored – an aggregate without any is not in the map. */
  load(db: Database, aggregateIds: readonly string[]): Promise<Map<string, Entry[]>>;
  /** Saves the aggregate's list as its state has it – what that means is the kind's. */
  save(tx: Database, aggregateId: string, entries: readonly Entry[]): Promise<void>;
};
