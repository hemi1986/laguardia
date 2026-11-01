import { sql } from "drizzle-orm";
import { journalOf, type Database } from "@/platform/command";
import { AI_SETTINGS_ID } from "./change-ai-settings";

/** The journal of the AI settings (ST-104), oldest first – for tests that check what a change recorded. */
export function aiSettingsJournal(db: Database) {
  return journalOf(db, { aggregateId: AI_SETTINGS_ID });
}

/**
 * Puts the AI settings of an isolated test database back to how the migration inserts them – no key, no models –, so
 * each test starts from "no technician has changed the AI settings yet". Its version goes on counting, as it would.
 */
export async function withoutAiSettings(db: Database): Promise<void> {
  await db.execute(
    sql`UPDATE ai_settings SET encrypted_key = NULL, key_last_four = NULL, chat_model = NULL, embedding_model = NULL, version = version + 1`,
  );
}

/** What is stored in the AI settings row, encrypted key included – to prove that the key itself is stored nowhere. */
export async function storedAiSettingsRow(db: Database): Promise<Record<string, unknown>> {
  const { rows } = await db.execute(sql`SELECT * FROM ai_settings`);
  return rows[0] as Record<string, unknown>;
}
