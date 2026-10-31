import { eq } from "drizzle-orm";
import { aggregateStore, entriesOf, lastCommandBy, type Database, type TeamMemberId } from "@/platform/command";
import { MUSEUM_DETAILS_ID, type MuseumDetails } from "./change-museum-details";
import { collectionEvents } from "./events";
import { MUSEUM_LOGO_ID, type LogoMediaType, type MuseumLogo } from "./replace-logo";
import { museumDetails as museumDetailsTable, museumLogo as museumLogoTable } from "./schema";

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

/**
 * How the logo part of AGG-MuseumSettings is stored (ST-102): its one row, versioned on its own (HS-16) – a reference to
 * the content and its media type, both null while there is no logo.
 */
export const museumLogoStore = aggregateStore({
  type: "AGG-MuseumSettings",
  table: museumLogoTable,
  toState: (row): MuseumLogo => ({
    id: row.id,
    logo: row.content ? { name: row.content, contentType: row.contentType as LogoMediaType } : undefined,
  }),
  toRow: ({ id, logo }: MuseumLogo) => ({ id, content: logo?.name ?? null, contentType: logo?.contentType ?? null }),
});

/** RM-MuseumSettings (ST-100, ST-102): what the museum settings page shows – the forms „Museum“ and „Logo“ with their versions. */
export type MuseumSettings = {
  museumName: string;
  machinesListed: boolean;
  /** The version of the museum details the form „Museum“ posts (HS-16). */
  museumDetailsVersion: number;
  /** The logo's content name – for the team page's view address only, never for a visitor page (HS-1 exception, ST-102). */
  logo: string | undefined;
  /** The version of the logo the form „Logo“ posts (HS-16). */
  logoVersion: number;
};

async function storedDetails(db: Database) {
  const [row] = await db.select().from(museumDetailsTable).where(eq(museumDetailsTable.id, MUSEUM_DETAILS_ID));
  // The migration inserts the one record; without it the database is not migrated.
  if (!row) throw new Error("The museum details are missing – is the database migrated?");
  return row;
}

async function storedLogo(db: Database) {
  const [row] = await db.select().from(museumLogoTable).where(eq(museumLogoTable.id, MUSEUM_LOGO_ID));
  // The migration inserts the one record; without it the database is not migrated.
  if (!row) throw new Error("The museum logo is missing – is the database migrated?");
  return row;
}

/** RM-MuseumSettings (ST-100, ST-102): the museum settings as the technician's page shows them. */
export async function museumSettings(db: Database): Promise<MuseumSettings> {
  const [details, logo] = await Promise.all([storedDetails(db), storedLogo(db)]);
  return {
    museumName: details.museumName,
    machinesListed: details.machinesListed,
    museumDetailsVersion: details.version,
    logo: logo.content ?? undefined,
    logoVersion: logo.version,
  };
}

/**
 * The logo's content name for the public address `/logo` (ST-102) – the one place outside a team page that issues a view
 * address (HS-1 exception: the logo is public by nature). Undefined without a logo.
 */
export async function museumLogo(db: Database): Promise<string | undefined> {
  return (await storedLogo(db)).content ?? undefined;
}

/** The museum's name – the one every visitor page that names the museum shows (ST-100), in every language. */
export async function museumName(db: Database): Promise<string> {
  return (await storedDetails(db)).museumName;
}

/**
 * What the team member's latest change of the logo was (ST-102), for the confirmation on the museum settings page (G3) –
 * only when the latest command on the logo is theirs. The logo's ID stays inside Collection, like the maintenance plan's.
 */
export async function logoChangedBy(db: Database, teamMemberId: TeamMemberId): Promise<"replaced" | "removed" | undefined> {
  const command = await lastCommandBy(db, { aggregateId: MUSEUM_LOGO_ID }, teamMemberId);
  const entries = command ? entriesOf(collectionEvents, command) : [];
  if (entries.some((entry) => entry.type === "EVT-LogoReplaced")) return "replaced";
  if (entries.some((entry) => entry.type === "EVT-LogoRemoved")) return "removed";
  return undefined;
}
