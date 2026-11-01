import {
  bigserial,
  doublePrecision,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  vector,
} from "drizzle-orm/pg-core";
import { EMBEDDING_SIZE } from "./ai-seam";
import { indexItemKinds, indexingFailureReasons } from "./ai-index-entry";

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

/**
 * AGG-AiIndexEntry (ST-106, data model *AI index entry*): what the AI index holds of one file and how far it got –
 * indexed with one embedding model, or failed with exactly one reason. Its ID is the file's ID, so a file has at most
 * one entry; it copies the file's owner (machine or machine model) because the owner never changes. Waiting is derived,
 * never stored: a file without an entry for the current embedding model waits.
 */
export const aiIndexEntry = pgTable(
  "ai_index_entry",
  {
    /** The file's ID – the aggregate's identity. */
    id: uuid("id").primaryKey(),
    /** Exactly one of the two, copied from the file (check constraint in the migration). */
    machineId: uuid("machine_id"),
    machineModelId: uuid("machine_model_id"),
    state: text("state", { enum: ["indexed", "failed"] }).notNull(),
    embeddingModel: text("embedding_model").notNull(),
    /** Indexed or failed at. */
    changedAt: timestamp("changed_at", { withTimezone: true }).notNull(),
    /** Exactly one when failed, none when indexed (check constraint). */
    failureReason: text("failure_reason", { enum: indexingFailureReasons }),
    /** A PDF's page count, and its page images plus image files – only when indexed. */
    pagesIndexed: integer("pages_indexed"),
    imagesIndexed: integer("images_indexed"),
    /** What OpenRouter charged, in US dollars – only when indexed. */
    cost: doublePrecision("cost"),
    /** Optimistic version check (HS-16): indexing a file again replaces the entry as a whole. */
    version: integer("version").notNull().default(0),
  },
  (table) => [index("ai_index_entry_embedding_model_idx").on(table.embeddingModel)],
);

/**
 * The index items of an AI index entry (ST-106, data model *Index item*): passages, PDF page images and images, each
 * with where it came from (file, page) and its embedding. They are never journaled and replaced as a whole with the
 * entry – a failed entry holds none.
 */
export const aiIndexItem = pgTable(
  "ai_index_item",
  {
    /** The item's ID from the command's ID generator. */
    id: uuid("id").primaryKey(),
    position: bigserial("position", { mode: "number" }).notNull(),
    /** The entry's – and therefore the file's – ID. */
    fileId: uuid("file_id")
      .notNull()
      .references(() => aiIndexEntry.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: indexItemKinds }).notNull(),
    /** The PDF page, for a page's text passage and its page image. */
    page: integer("page"),
    /** The passage's text – what an AI assessment sends of a text hit; none for an image. */
    text: text("text"),
    embedding: vector("embedding", { dimensions: EMBEDDING_SIZE }).notNull(),
  },
  (table) => [index("ai_index_item_file_idx").on(table.fileId)],
);
