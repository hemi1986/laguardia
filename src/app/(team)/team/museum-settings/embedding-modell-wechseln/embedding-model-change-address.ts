import {
  confirmEmbeddingModelFields,
  type AiSettingsFormField,
  type ConfirmEmbeddingModelField,
} from "../ai-settings-form-input";

/**
 * Where a save of the form „KI“ lands (ST-110): „Schlüssel ersetzt.“ when a new key was typed into „Neuer
 * API-Schlüssel“ (the field after „Ersetzen“), otherwise „KI gespeichert.“.
 */
export function aiSaveLanding(formData: FormData): { keyTyped: boolean; landing: "saved" | "key-replaced" } {
  const keyTyped = String(formData.get("key") ?? "").trim() !== "";
  return { keyTyped, landing: keyTyped && formData.get("keyOffered") === "replace" ? "key-replaced" : "saved" };
}

/** What the form „KI“ chose that a page passes on in its address – the models, never the key (G36). */
export type ChosenModels = { [Field in ConfirmEmbeddingModelField]?: string };

function withChosen(path: string, chosen: ChosenModels): string {
  const params = new URLSearchParams();
  for (const name of confirmEmbeddingModelFields) {
    const value = chosen[name];
    if (value) params.set(name, value);
  }
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

/** The warning before the embedding model changes (ST-110): a page of its own, so it works without JavaScript. */
const EMBEDDING_MODEL_CHANGE_PAGE = "/team/museum-settings/embedding-modell-wechseln";

/** „Zurück“ from the warning (G10b): the form „KI“ unchanged, with the models the technician chose. */
export function backToAiForm(chosen: ChosenModels): string {
  return `${withChosen("/team/museum-settings", { chatModel: chosen.chatModel, embeddingModel: chosen.embeddingModel })}#ki`;
}

/**
 * Where a save of the form „KI“ goes that changed the saved embedding model without the warning (ST-110): to the
 * warning, with the models chosen and the version seen. A new key typed in the same save cannot go along – it is never
 * put into an address or a page (G36) –, so then the form stays with the rejection, which asks to save the key first.
 */
export function embeddingModelWarning(
  state: { error: string; values: Partial<Record<AiSettingsFormField, string>> } | null,
  keyTyped: boolean,
): string | undefined {
  if (state?.error !== "embedding-model-change-unconfirmed" || keyTyped) return undefined;
  const { version, chatModel, embeddingModel } = state.values;
  return withChosen(EMBEDDING_MODEL_CHANGE_PAGE, { version, chatModel, embeddingModel });
}
