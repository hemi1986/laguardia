import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { executeCommand, type Database } from "@/platform/command";
import type { Clock } from "@/platform/clock";
import { EMBEDDING_SIZE } from "./ai-seam";
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

/** The embedding model of every AI index entry, by file – to show that nothing was indexed again. */
export async function aiIndexEntryModels(db: Database): Promise<Record<string, string>> {
  const { rows } = await db.execute<{ id: string; embedding_model: string }>(
    sql`SELECT id, embedding_model FROM ai_index_entry ORDER BY id`,
  );
  return Object.fromEntries(rows.map((row) => [row.id, row.embedding_model]));
}
