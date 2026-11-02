import { and, count, eq, sum } from "drizzle-orm";
import type { Database } from "@/platform/command";
import { savedAiModels, type AiDependencies } from "./ai-settings";
import { changedModel } from "./change-ai-settings";
import { aiIndexEntry } from "./schema";
import { TOKENS_PER_PAGE_OR_IMAGE } from "./tokens-per-page-or-image";

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
 * The estimate the warning before a change of the embedding model shows – part of RM-AiSettings (CMD-ChangeAiSettings'
 * rule, ADR 0014
 * *Consequences*): **pages and images of the current AI index entries × tokens per page or image × the new model's
 * price per million tokens**. A PDF page is indexed as its text and its page image and counts once – its page images
 * are the entry's images –, an image file counts once; the passages of a text file are not counted (a few tokens).
 */
export async function embeddingModelChange(
  db: Database,
  { ai }: Pick<AiDependencies, "ai">,
  chosen: { embeddingModel: string; chatModel?: string },
): Promise<EmbeddingModelChange | NoEmbeddingModelChange> {
  const saved = await savedAiModels(db);
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
    estimatedCost: (pagesAndImages * TOKENS_PER_PAGE_OR_IMAGE * model.pricePerMillion.input) / 1_000_000,
  };
}
