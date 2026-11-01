import { and, count, eq, sum } from "drizzle-orm";
import type { Database } from "@/platform/command";
import { aiAssessmentSettings, type AiDependencies } from "./ai-settings";
import { changedModel } from "./change-ai-settings";
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
  /**
   * The chat model chosen in the same save, when it differs from the saved one – the confirmation saves it too, so the
   * warning names it (code review ST-110); its ID when OpenRouter does not answer for it.
   */
  chatModel?: { id: string; name: string };
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
  dependencies: AiDependencies,
  chosen: { embeddingModel: string; chatModel?: string },
  tokensPerPageOrImage = TOKENS_PER_PAGE_OR_IMAGE,
): Promise<EmbeddingModelChange | NoEmbeddingModelChange> {
  const { ai } = dependencies;
  const saved = await aiAssessmentSettings(db, dependencies);
  const embeddingModel = saved.embeddingModel;
  // Compared as the command compares them (`changedModel`): trimmed, and only when it differs from the saved one.
  const newModel = changedModel(embeddingModel, chosen.embeddingModel);
  if (!embeddingModel || !newModel) return "no-change";
  const newChatModel = changedModel(saved.chatModel, chosen.chatModel);
  const [model, chat, [indexed]] = await Promise.all([
    ai.model("embedding", newModel),
    newChatModel ? ai.model("chat", newChatModel) : undefined,
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
    ...(newChatModel && { chatModel: { id: newChatModel, name: typeof chat === "object" ? chat.name : newChatModel } }),
    files: indexed?.files ?? 0,
    pagesAndImages,
    estimatedCost: (pagesAndImages * tokensPerPageOrImage * model.pricePerMillion.input) / 1_000_000,
  };
}
