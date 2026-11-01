import { and, eq } from "drizzle-orm";
import { aggregateStore, replaces, type Database } from "@/platform/command";
import type { AiIndexEntryState, AiIndexItem } from "./ai-index-entry";
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
    owner: row.machineId ? { machineId: row.machineId } : { machineModelId: row.machineModelId! },
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
    machineId: "machineId" in state.owner ? state.owner.machineId : null,
    machineModelId: "machineModelId" in state.owner ? state.owner.machineModelId : null,
    state: state.state,
    embeddingModel: state.embeddingModel,
    changedAt: state.at,
    failureReason: state.state === "failed" ? (state.failureReason ?? null) : null,
    pagesIndexed: state.state === "indexed" ? state.pagesIndexed : null,
    imagesIndexed: state.state === "indexed" ? state.imagesIndexed : null,
    cost: state.state === "indexed" ? state.cost : null,
  }),
});

/** The AI index entry of one file, with its items – undefined when the file has none (it is waiting). */
export async function aiIndexEntryOf(db: Database, fileId: string): Promise<AiIndexEntryState | undefined> {
  return (await aiIndexEntries.load(db, fileId))?.state;
}

/** Whether the file already has an entry made with this embedding model – indexed or failed (never retried by a run). */
export async function aiIndexHasEntryFor(db: Database, fileId: string, embeddingModel: string): Promise<boolean> {
  const [row] = await db
    .select({ id: aiIndexEntry.id })
    .from(aiIndexEntry)
    .where(and(eq(aiIndexEntry.id, fileId), eq(aiIndexEntry.embeddingModel, embeddingModel)))
    .limit(1);
  return !!row;
}

/** The files that already have an entry for this embedding model – what a run leaves out when it looks for waiting files. */
export async function aiIndexedFileIds(db: Database, embeddingModel: string): Promise<Set<string>> {
  const rows = await db
    .select({ id: aiIndexEntry.id })
    .from(aiIndexEntry)
    .where(eq(aiIndexEntry.embeddingModel, embeddingModel));
  return new Set(rows.map((row) => row.id));
}

/** Whether the file has any AI index entry – the removal policy asks before it removes one (EVT-FileLeftAiIndex). */
export async function hasAiIndexEntry(db: Database, fileId: string): Promise<boolean> {
  const [row] = await db.select({ id: aiIndexEntry.id }).from(aiIndexEntry).where(eq(aiIndexEntry.id, fileId)).limit(1);
  return !!row;
}
