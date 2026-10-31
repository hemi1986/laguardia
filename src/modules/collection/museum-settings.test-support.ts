import { sql } from "drizzle-orm";
import { journalOf, type Database } from "@/platform/command";
import { LEGAL_TEXTS_ID } from "./change-legal-texts";
import { MUSEUM_DETAILS_ID } from "./change-museum-details";
import { MUSEUM_LOGO_ID } from "./replace-logo";

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

/** The journal of the logo (ST-102), oldest first – for tests that check what a change of the logo recorded. */
export function museumLogoJournal(db: Database) {
  return journalOf(db, { aggregateId: MUSEUM_LOGO_ID });
}

/**
 * Puts the logo of an isolated test database back to its default – no logo, as the migration inserts it – so each test
 * starts from "the museum has no logo". Its version goes on counting, as it would.
 */
export async function withoutLogo(db: Database): Promise<void> {
  await db.execute(sql`UPDATE museum_logo SET content = NULL, content_type = NULL, version = version + 1`);
}

/** The journal of the legal texts (ST-103), oldest first – for tests that check what a save recorded. */
export function legalTextsJournal(db: Database) {
  return journalOf(db, { aggregateId: LEGAL_TEXTS_ID });
}

/**
 * Puts the legal texts of an isolated test database back to their defaults – the placeholder privacy notice (the
 * columns' defaults, as the migration inserts them) and no imprint –, so each test starts from "no technician has changed
 * the legal texts yet". Its version goes on counting, as it would.
 */
export async function withDefaultLegalTexts(db: Database): Promise<void> {
  await db.execute(
    sql`UPDATE legal_texts SET privacy_notice_de = DEFAULT, privacy_notice_en = DEFAULT, imprint_de = NULL,
      imprint_en = NULL, version = version + 1`,
  );
}
