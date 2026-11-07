import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { Database } from "@/platform/command";
import type { IndexItemKind } from "./ai-index-entry";
import { aiIndexEntry, aiIndexItem } from "./schema";

/**
 * Searching the AI index (ST-107, ADR 0014; ST-125): for an AI assessment only the entries of the files attached to the defect's
 * machine or its machine model – the list Collection gave when the writing began (ST-120, ADR 0018) – and only those
 * made with the current embedding model; for an AI model proposal every file that is not removed (ST-125, ADR 0018).
 * A search is exact – the index of one machine and its model, or of a few hundred files, is small enough –
 * ordered by cosine distance, and takes a fixed number of the best text passages and the best pages or images (not a
 * setting).
 */

/** How many of the best text passages one search takes (user, 2026-10-31). */
export const SEARCH_TEXT_HITS = 8;
/** How many of the best pages or images one search takes (user, 2026-10-31). */
export const SEARCH_IMAGE_HITS = 4;

/** One found item, with where it came from. */
export type AiIndexHit = {
  /** The AI index item's ID – two passages of one file or page are distinct hits. */
  id: string;
  fileId: string;
  kind: "passage" | "page-image" | "image";
  page?: number;
  /** The passage's text – only for a passage. */
  text?: string;
};

export type AiIndexSearch = { passages: AiIndexHit[]; images: AiIndexHit[] };

/** Where a search looks: the files attached to the defect's machine or its machine model, and the current embedding model. */
export type AiIndexScope = { fileIds: readonly string[]; embeddingModel: string };

const vectorOf = (embedding: readonly number[]) => sql.raw(`'[${embedding.map(Number).join(",")}]'::vector`);

/**
 * The best text passages and pages or images of the scope for one query embedding. `passage`: only passages; otherwise
 * page images and image files. Each search takes the fixed number of best hits, never more.
 */
export async function searchAiIndex(
  db: Database,
  scope: AiIndexScope,
  query: readonly number[],
  kind: "text" | "image",
): Promise<AiIndexHit[]> {
  if (scope.fileIds.length === 0) return [];
  const distance = sql<number>`${aiIndexItem.embedding} <=> ${vectorOf(query)}`;
  const kinds: readonly IndexItemKind[] = kind === "text" ? ["passage"] : ["page-image", "image"];
  const rows = await db
    .select({
      id: aiIndexItem.id,
      fileId: aiIndexItem.fileId,
      kind: aiIndexItem.kind,
      page: aiIndexItem.page,
      text: aiIndexItem.text,
      distance,
    })
    .from(aiIndexItem)
    .innerJoin(aiIndexEntry, eq(aiIndexEntry.id, aiIndexItem.fileId))
    .where(
      and(
        eq(aiIndexEntry.state, "indexed"),
        eq(aiIndexEntry.embeddingModel, scope.embeddingModel),
        inArray(aiIndexItem.kind, kinds),
        inArray(aiIndexEntry.id, [...scope.fileIds]),
      ),
    )
    .orderBy(distance)
    .limit(kind === "text" ? SEARCH_TEXT_HITS : SEARCH_IMAGE_HITS);
  return rows.map(({ id, fileId, kind: hitKind, page, text }) => ({
    id,
    fileId,
    kind: hitKind as AiIndexHit["kind"],
    ...(page !== null && { page }),
    ...(text !== null && { text }),
  }));
}

/** The files whose entries a search over this scope could find – "Files searched" of EVT-AiAssessmentWritten. */
export async function searchedFiles(db: Database, scope: AiIndexScope): Promise<string[]> {
  if (scope.fileIds.length === 0) return [];
  const rows = await db
    .selectDistinct({ fileId: aiIndexEntry.id })
    .from(aiIndexEntry)
    .where(
      and(
        eq(aiIndexEntry.state, "indexed"),
        eq(aiIndexEntry.embeddingModel, scope.embeddingModel),
        inArray(aiIndexEntry.id, [...scope.fileIds]),
      ),
    )
    .orderBy(desc(aiIndexEntry.id));
  return rows.map((row) => row.fileId);
}
