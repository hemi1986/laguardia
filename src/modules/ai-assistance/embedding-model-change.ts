import { and, count, eq, sum } from "drizzle-orm";
import type { Database } from "@/platform/command";
import { aiIndexingSettings, type AiDependencies } from "./ai-settings";
import { aiIndexEntry } from "./schema";

/**
 * Tokens per page or image indexed – what one costs at an embedding model, measured by the spike ST-105 with
 * `google/gemini-embedding-2` (2026-11-01): a page image 258 tokens, a PDF page's text passage 274 on average, so a PDF
 * page ≈ 530. One constant for both (ST-110): the PDF page's, so an image is rather over- than underestimated.
 */
export const TOKENS_PER_PAGE_OR_IMAGE = 530;

/** What changing the embedding model will cost (ST-110): every indexed file again, at the new model's price. */
export type EmbeddingModelChange = {
  /** The new embedding model, as OpenRouter names it. */
  model: { id: string; name: string };
  /** The files indexed with the current embedding model – all of them are indexed again. */
  files: number;
  /** Their pages and images. */
  pagesAndImages: number;
  /** Pages and images × tokens per page or image × the new model's price per million tokens, in dollars. */
  estimatedCost: number;
};

/** Why there is no estimate: the model is the current one (or none is saved), OpenRouter does not know it, or is down. */
export type NoEmbeddingModelChange = "no-change" | "embedding-model-unknown" | "openrouter-unreachable";

/**
 * The estimate the warning before a change of the embedding model shows (CMD-ChangeAiSettings' rule, ADR 0014
 * *Consequences*): **pages and images of the current AI index entries × tokens per page or image × the new model's
 * price per million tokens**. A PDF page is indexed as its text and its page image and counts once – its page images
 * are the entry's images –, an image file counts once; the passages of a text file are not counted (a few tokens).
 */
export async function embeddingModelChange(
  db: Database,
  { ai, encryptionKey }: AiDependencies,
  newModel: string,
  tokensPerPageOrImage = TOKENS_PER_PAGE_OR_IMAGE,
): Promise<EmbeddingModelChange | NoEmbeddingModelChange> {
  const { embeddingModel } = await aiIndexingSettings(db, { encryptionKey });
  if (!embeddingModel || newModel === embeddingModel) return "no-change";
  const [model, [indexed]] = await Promise.all([
    ai.model("embedding", newModel),
    db
      .select({ files: count(), images: sum(aiIndexEntry.imagesIndexed).mapWith(Number) })
      .from(aiIndexEntry)
      .where(and(eq(aiIndexEntry.embeddingModel, embeddingModel), eq(aiIndexEntry.state, "indexed"))),
  ]);
  if (model === "unknown") return "embedding-model-unknown";
  if (model === "unreachable") return "openrouter-unreachable";
  const pagesAndImages = indexed?.images ?? 0;
  return {
    model: { id: model.id, name: model.name },
    files: indexed?.files ?? 0,
    pagesAndImages,
    estimatedCost: (pagesAndImages * tokensPerPageOrImage * model.pricePerMillion.input) / 1_000_000,
  };
}
