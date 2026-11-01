import { integer, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

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

/**
 * The technical hold of the background work (ST-112, ADR 0015, data model *Technical, not domain*): while a run works
 * on a piece of work – one file or one AI assessment – it holds it here until `held_until`, so two runs never do (and
 * pay for) the same piece. Not domain state: no event, no read model, not part of an aggregate. A hold ends with the
 * piece's result (in the transaction that stores it) or when the run gives the piece up; one that ran out without a
 * result is what EVT-AiWorkLeftUnfinished is derived from, and the next run records the piece broken off.
 */
export const aiWorkHold = pgTable(
  "ai_work_hold",
  {
    /** The kind of work – which kind's query found the piece and which kind records it broken off. */
    kind: text("kind").notNull(),
    /** The file's or the AI assessment's ID. */
    pieceId: uuid("piece_id").notNull(),
    /** The run holding it – only that run may store the piece's result or give it up. */
    heldBy: uuid("held_by").notNull(),
    heldUntil: timestamp("held_until", { withTimezone: true }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.kind, table.pieceId] })],
);
