import { and, eq, inArray } from "drizzle-orm";
import { aggregateStore, replaces, type Database } from "@/platform/command";
import {
  ownerColumns,
  ownerOf,
  type AiIndexEntryState,
  type AiIndexItem,
  type IndexingFailureReason,
} from "./ai-index-entry";
import { aiIndexEntry, aiIndexItem } from "./schema";

/**
 * How AGG-AiIndexEntry is stored (ST-106): one row per file, identified by the file's ID and replaced as a whole when
 * a file is indexed again – its items, the passages, page images and images with their embeddings, go with it. A failed
 * entry holds no item. Waiting is not stored: a file without an entry for the current embedding model waits.
 */
const items = replaces({
  table: aiIndexItem,
  owner: "fileId",
  toEntry: (row): AiIndexItem => ({
    id: row.id,
    kind: row.kind,
    ...(row.page !== null && { page: row.page }),
    ...(row.text !== null && { text: row.text }),
    embedding: row.embedding as number[],
  }),
  toRow: (item) => ({
    id: item.id,
    kind: item.kind,
    page: item.page ?? null,
    text: item.text ?? null,
    embedding: item.embedding,
  }),
});

export const aiIndexEntries = aggregateStore({
  type: "AGG-AiIndexEntry",
  table: aiIndexEntry,
  insertReplaces: true,
  replaces: { items },
  toState: (row, lists): AiIndexEntryState => ({
    id: row.id,
    owner: ownerOf(row),
    state: row.state,
    embeddingModel: row.embeddingModel,
    at: row.changedAt,
    ...(row.failureReason && { failureReason: row.failureReason }),
    pagesIndexed: row.pagesIndexed ?? 0,
    imagesIndexed: row.imagesIndexed ?? 0,
    cost: row.cost ?? 0,
    items: row.state === "indexed" ? lists.items : [],
  }),
  toRow: (state: AiIndexEntryState) => ({
    id: state.id,
    ...ownerColumns(state.owner),
    state: state.state,
    embeddingModel: state.embeddingModel,
    changedAt: state.at,
    failureReason: state.state === "failed" ? (state.failureReason ?? null) : null,
    pagesIndexed: state.state === "indexed" ? state.pagesIndexed : null,
    imagesIndexed: state.state === "indexed" ? state.imagesIndexed : null,
    cost: state.cost,
  }),
});

/** The AI index entry of one file, with its items – undefined when the file has none (it is waiting). */
export async function aiIndexEntryOf(db: Database, fileId: string): Promise<AiIndexEntryState | undefined> {
  return (await aiIndexEntries.load(db, fileId))?.state;
}

/**
 * Where a file stands in the AI index for one embedding model, the one answer (architecture review 2026-11-01): failed or
 * indexed when it has an entry made with that model, otherwise waiting – an entry of another model counts as none.
 */
export type AiIndexStateOfFile =
  | { state: "waiting" }
  | { state: "indexed"; version: number }
  | { state: "failed"; reason: IndexingFailureReason; version: number };

/** The state of each of these files for this embedding model. Which files there are is Collection's to say. */
export async function aiIndexStatesOfFiles(
  db: Database,
  embeddingModel: string,
  fileIds: readonly string[],
): Promise<Map<string, AiIndexStateOfFile>> {
  if (fileIds.length === 0) return new Map();
  const rows = await db
    .select({
      id: aiIndexEntry.id,
      state: aiIndexEntry.state,
      failureReason: aiIndexEntry.failureReason,
      version: aiIndexEntry.version,
    })
    .from(aiIndexEntry)
    .where(and(eq(aiIndexEntry.embeddingModel, embeddingModel), inArray(aiIndexEntry.id, [...fileIds])));
  const entries = new Map(rows.map((row) => [row.id, row]));
  return new Map(
    fileIds.map((id): [string, AiIndexStateOfFile] => {
      const entry = entries.get(id);
      if (!entry) return [id, { state: "waiting" }];
      if (entry.state === "indexed") return [id, { state: "indexed", version: entry.version }];
      // A failed entry has exactly one reason (check constraint).
      return [id, { state: "failed", reason: entry.failureReason!, version: entry.version }];
    }),
  );
}

/** Whether the file has any AI index entry – the removal policy asks before it removes one (EVT-FileLeftAiIndex). */
export async function hasAiIndexEntry(db: Database, fileId: string): Promise<boolean> {
  const rows = await db.select({ id: aiIndexEntry.id }).from(aiIndexEntry).where(eq(aiIndexEntry.id, fileId));
  return rows.length > 0;
}
