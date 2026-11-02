import {
  aiDependencies,
  embeddingModelChange,
  type AiDependencies,
  type EmbeddingModelChange,
  type NoEmbeddingModelChange,
} from "@/modules/ai-assistance";
import type { Database } from "@/platform/command";
import { confirmEmbeddingModelFields, type ConfirmEmbeddingModelField } from "../ai-settings-form-input";
import { backToAiForm, type ChosenModels } from "./embedding-model-change-address";

/** The warning page's data (ST-110): the estimate, what its confirmation posts, and where „Zurück“ goes. */
export type EmbeddingModelChangeData = {
  change: EmbeddingModelChange | NoEmbeddingModelChange;
  /** What „Embedding-Modell wechseln“ posts – the models chosen on the form „KI“ at the version it showed. */
  posted: Record<ConfirmEmbeddingModelField, string>;
  /** „Zurück“: the form „KI“ unchanged, with the models chosen (G10b). */
  back: string;
};

const one = (value: string | string[] | undefined) => (typeof value === "string" ? value : undefined);

/**
 * Reads the warning's address – the models chosen on the form „KI“ and the version it showed (never a key) – and asks
 * AI assistance for the estimate. Tests pass the in-memory AI.
 */
export async function loadEmbeddingModelChange(
  db: Database,
  params: Record<string, string | string[] | undefined>,
  { dependencies = aiDependencies() }: { dependencies?: AiDependencies } = {},
): Promise<EmbeddingModelChangeData> {
  const chosen: ChosenModels = Object.fromEntries(confirmEmbeddingModelFields.map((name) => [name, one(params[name])]));
  const change = chosen.embeddingModel
    ? await embeddingModelChange(db, dependencies, {
        embeddingModel: chosen.embeddingModel,
        chatModel: chosen.chatModel,
      })
    : "no-change";
  return {
    change,
    posted: {
      version: chosen.version ?? "",
      chatModel: chosen.chatModel ?? "",
      embeddingModel: chosen.embeddingModel ?? "",
    } satisfies Record<ConfirmEmbeddingModelField, string>,
    back: backToAiForm(chosen),
  };
}
