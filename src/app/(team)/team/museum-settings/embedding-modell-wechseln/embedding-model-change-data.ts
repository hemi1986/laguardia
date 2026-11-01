import {
  aiDependencies,
  embeddingModelChange,
  TOKENS_PER_PAGE_OR_IMAGE,
  type AiDependencies,
  type EmbeddingModelChange,
  type NoEmbeddingModelChange,
} from "@/modules/ai-assistance";
import type { Database } from "@/platform/command";
import { backToAiForm, type ChosenModels } from "../ai-settings-form-input";

/** The warning page's data (ST-110): the estimate, what its confirmation posts, and where „Zurück“ goes. */
export type EmbeddingModelChangeData = {
  change: EmbeddingModelChange | NoEmbeddingModelChange;
  /** What „Embedding-Modell wechseln“ posts – the models chosen on the form „KI“ at the version it showed. */
  posted: { version: string; chatModel: string; embeddingModel: string };
  /** „Zurück“: the form „KI“ unchanged, with the models chosen (G10b). */
  back: string;
};

const one = (value: string | string[] | undefined) => (typeof value === "string" ? value : undefined);

/**
 * Reads the warning's address – the models chosen on the form „KI“ and the version it showed (never a key) – and asks
 * AI assistance for the estimate. Tests pass the in-memory AI and the tokens per page or image of their scenario.
 */
export async function loadEmbeddingModelChange(
  db: Database,
  params: Record<string, string | string[] | undefined>,
  {
    dependencies = aiDependencies(),
    tokensPerPageOrImage = TOKENS_PER_PAGE_OR_IMAGE,
  }: { dependencies?: AiDependencies; tokensPerPageOrImage?: number } = {},
): Promise<EmbeddingModelChangeData> {
  const chosen: ChosenModels = {
    version: one(params.version),
    chatModel: one(params.chatModel),
    embeddingModel: one(params.embeddingModel),
  };
  const change = chosen.embeddingModel
    ? await embeddingModelChange(
        db,
        dependencies,
        { embeddingModel: chosen.embeddingModel, chatModel: chosen.chatModel },
        tokensPerPageOrImage,
      )
    : "no-change";
  return {
    change,
    posted: {
      version: chosen.version ?? "",
      chatModel: chosen.chatModel ?? "",
      embeddingModel: chosen.embeddingModel ?? "",
    },
    back: backToAiForm(chosen),
  };
}
