import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { Database } from "@/platform/command";
import type { IndexItemKind } from "./ai-index-entry";
import { aiIndexEntry, aiIndexItem } from "./schema";

/**
 * Searching the AI index for an AI assessment (ST-107, ADR 0014): only the entries of the defect's machine and its
 * machine model, and only those made with the current embedding model. A search is exact – the index of one machine and
 * its model is small enough – ordered by cosine distance, and takes a fixed number of the best text passages and the
 * best pages or images (not a setting).
 */

/** How many of the best text passages one search takes (user, 2026-10-31). */
export const SEARCH_TEXT_HITS = 8;
/** How many of the best pages or images one search takes (user, 2026-10-31). */
export const SEARCH_IMAGE_HITS = 4;

/** One found item, with where it came from. */
export type AiIndexHit = {
  fileId: string;
  kind: "passage" | "page-image" | "image";
  page?: number;
  /** The passage's text – only for a passage. */
  text?: string;
};

export type AiIndexSearch = { passages: AiIndexHit[]; images: AiIndexHit[] };

/** Where a search looks: the defect's machine, its machine model and the current embedding model. */
export type AiIndexScope = { machineId: string; machineModelId: string; embeddingModel: string };

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
  const distance = sql<number>`${aiIndexItem.embedding} <=> ${vectorOf(query)}`;
  const kinds: readonly IndexItemKind[] = kind === "text" ? ["passage"] : ["page-image", "image"];
  const rows = await db
    .select({
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
        sql`(${aiIndexEntry.machineId} = ${scope.machineId} OR ${aiIndexEntry.machineModelId} = ${scope.machineModelId})`,
      ),
    )
    .orderBy(distance)
    .limit(kind === "text" ? SEARCH_TEXT_HITS : SEARCH_IMAGE_HITS);
  return rows.map(({ fileId, kind: hitKind, page, text }) => ({
    fileId,
    kind: hitKind as AiIndexHit["kind"],
    ...(page !== null && { page }),
    ...(text !== null && { text }),
  }));
}

/** The files whose entries a search over this scope could find – "Files searched" of EVT-AiAssessmentWritten. */
export async function searchedFiles(db: Database, scope: AiIndexScope): Promise<string[]> {
  const rows = await db
    .selectDistinct({ fileId: aiIndexEntry.id })
    .from(aiIndexEntry)
    .where(
      and(
        eq(aiIndexEntry.state, "indexed"),
        eq(aiIndexEntry.embeddingModel, scope.embeddingModel),
        sql`(${aiIndexEntry.machineId} = ${scope.machineId} OR ${aiIndexEntry.machineModelId} = ${scope.machineModelId})`,
      ),
    )
    .orderBy(desc(aiIndexEntry.id));
  return rows.map((row) => row.fileId);
}
