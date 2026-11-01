import { randomUUID } from "node:crypto";
import { executeCommand, journalOf, type Database } from "@/platform/command";
import type { Clock } from "@/platform/clock";
import { EMBEDDING_SIZE } from "./ai-seam";
import { aiIndexEntryOf } from "./ai-index-entries";
import { indexFileForAiCommand } from "./index-file-for-ai-command";

/**
 * A file indexed for AI through CMD-IndexFileForAi as the system, the way the background work stores it (ST-110) – with
 * the counts of a PDF of `pages` pages (each page indexed as its text and its page image) and one passage only, so a
 * test can have an AI index of 1.200 pages and images without rendering them.
 */
export async function anIndexedFile(
  db: Database,
  clock: Clock,
  fileId: string,
  { embeddingModel, pages, text = "Eine Textstelle" }: { embeddingModel: string; pages: number; text?: string },
): Promise<void> {
  const indexed = await executeCommand(
    indexFileForAiCommand,
    {
      fileId,
      embeddingModel,
      result: {
        items: [{ kind: "passage", page: 1, text, embedding: Array.from({ length: EMBEDDING_SIZE }, () => 0.5) }],
        pagesIndexed: pages,
        imagesIndexed: pages,
        cost: 0.0001,
      },
    },
    { actor: { kind: "system" }, db, clock, newId: randomUUID },
  );
  if (!indexed.ok) throw new Error(indexed.error);
}

/**
 * What the AI index holds of these files – the embedding model of each entry and how often the file was indexed
 * (EVT-FileIndexedForAi in its journal) –, to show that nothing was indexed again, not even with the same model.
 */
export async function aiIndexOf(
  db: Database,
  fileIds: readonly string[],
): Promise<Record<string, { embeddingModel: string | undefined; indexings: number }>> {
  const entries = await Promise.all(
    fileIds.map(async (fileId) => {
      const [entry, journal] = await Promise.all([aiIndexEntryOf(db, fileId), journalOf(db, { aggregateId: fileId })]);
      const indexings = journal.filter((each) => each.type === "EVT-FileIndexedForAi").length;
      return [fileId, { embeddingModel: entry?.embeddingModel, indexings }] as const;
    }),
  );
  return Object.fromEntries(entries);
}
