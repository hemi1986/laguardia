import { and, eq, sql } from "drizzle-orm";
import type { Database } from "@/platform/command";
import { aiIndexEntry, aiIndexItem } from "./schema";

/**
 * RM-FileOverview, AI assistance's part (ST-118, context map step 2): per word, the files with a passage that contains
 * it and the rank of their best passage. It reads the stored words of the passages of *indexed* entries – whatever their
 * embedding model, whether AI is on or not –, needs no AI settings and makes no request to OpenRouter: it works on words,
 * never on embeddings. It knows nothing of the overview; a file that is not in the answer has no passage with the word
 * (a scanned page has no passage, a failed entry holds none).
 *
 * `words` are what the page made of the search – lower-case, without punctuation. German and English word forms are
 * searched together ("Spule" finds "Spulen", "coil" finds "coils"). The answer has one entry per word, in their order.
 */
export type FilesContainingWords = ReadonlyMap<string, number>[];

export async function filesContainingWords(db: Database, words: readonly string[]): Promise<FilesContainingWords> {
  return Promise.all(words.map((word) => filesContaining(db, word)));
}

async function filesContaining(db: Database, word: string): Promise<ReadonlyMap<string, number>> {
  const query = sql`(plainto_tsquery('german'::regconfig, ${word}) || plainto_tsquery('english'::regconfig, ${word}))`;
  const rank = sql<number>`max(ts_rank(${aiIndexItem.words}, ${query}))`;
  const rows = await db
    .select({ fileId: aiIndexItem.fileId, rank })
    .from(aiIndexItem)
    .innerJoin(aiIndexEntry, eq(aiIndexEntry.id, aiIndexItem.fileId))
    .where(
      and(eq(aiIndexEntry.state, "indexed"), eq(aiIndexItem.kind, "passage"), sql`${aiIndexItem.words} @@ ${query}`),
    )
    .groupBy(aiIndexItem.fileId);
  return new Map(rows.map((row) => [row.fileId, Number(row.rank)]));
}
