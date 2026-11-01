import { integer, pgTable, text, uuid } from "drizzle-orm/pg-core";

/**
 * AGG-AiSettings (ST-104, data model *AI settings*): the museum's OpenRouter key – only encrypted, with its last four
 * characters for the form –, the chat model and the embedding model. Exactly one row, inserted without values by the
 * migration – never created or removed by a command. AI is on while all three are saved (derived, not stored).
 */
export const aiSettings = pgTable("ai_settings", {
  id: uuid("id").primaryKey(),
  /** `EncryptedKey` (ADR 0014) – never the key itself. */
  encryptedKey: text("encrypted_key"),
  keyLastFour: text("key_last_four"),
  chatModel: text("chat_model"),
  embeddingModel: text("embedding_model"),
  /** Optimistic version check (HS-16). */
  version: integer("version").notNull().default(0),
});
