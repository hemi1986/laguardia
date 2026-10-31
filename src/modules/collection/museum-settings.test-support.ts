import { sql } from "drizzle-orm";
import { journalOf, type Database } from "@/platform/command";
import { MUSEUM_DETAILS_ID } from "./change-museum-details";

/** The museum name the migration inserts – the default until a technician changes it (data model, *Museum settings*). */
export const DEFAULT_MUSEUM_NAME = "Flipper- & Arcade Museum Eschbach";

/** The journal of the museum details (ST-100), oldest first – for tests that check what a save recorded. */
export function museumDetailsJournal(db: Database) {
  return journalOf(db, { aggregateId: MUSEUM_DETAILS_ID });
}

/**
 * Puts the museum details of an isolated test database back to their defaults – as the migration inserts them – so each
 * test starts from "no technician has changed the museum details yet". Its version goes on counting, as it would.
 */
export async function withDefaultMuseumDetails(db: Database): Promise<void> {
  await db.execute(
    sql`UPDATE museum_details SET museum_name = ${DEFAULT_MUSEUM_NAME}, machines_listed = false, version = version + 1`,
  );
}
