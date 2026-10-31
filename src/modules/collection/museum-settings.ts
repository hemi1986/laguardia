import { eq } from "drizzle-orm";
import { aggregateStore, type Database } from "@/platform/command";
import { MUSEUM_DETAILS_ID, type MuseumDetails } from "./change-museum-details";
import { museumDetails as museumDetailsTable } from "./schema";

/**
 * How the museum details part of AGG-MuseumSettings is stored (ST-100): its one row, versioned on its own (HS-16) – the
 * logo and the legal texts get records of their own the same way (ST-102, ST-103).
 */
export const museumDetailsStore = aggregateStore({
  type: "AGG-MuseumSettings",
  table: museumDetailsTable,
  toState: (row): MuseumDetails => ({
    id: row.id,
    museumName: row.museumName,
    machinesListed: row.machinesListed,
  }),
  toRow: (details: MuseumDetails) => details,
});

/** RM-MuseumSettings (ST-100): what the museum settings page shows – so far the form „Museum“ and its version. */
export type MuseumSettings = {
  museumName: string;
  machinesListed: boolean;
  /** The version of the museum details the form „Museum“ posts (HS-16). */
  museumDetailsVersion: number;
};

async function storedDetails(db: Database) {
  const [row] = await db.select().from(museumDetailsTable).where(eq(museumDetailsTable.id, MUSEUM_DETAILS_ID));
  // The migration inserts the one record; without it the database is not migrated.
  if (!row) throw new Error("The museum details are missing – is the database migrated?");
  return row;
}

/** RM-MuseumSettings (ST-100): the museum settings as the technician's page shows them. */
export async function museumSettings(db: Database): Promise<MuseumSettings> {
  const row = await storedDetails(db);
  return { museumName: row.museumName, machinesListed: row.machinesListed, museumDetailsVersion: row.version };
}

/** The museum's name – the one every visitor page that names the museum shows (ST-100), in every language. */
export async function museumName(db: Database): Promise<string> {
  return (await storedDetails(db)).museumName;
}
