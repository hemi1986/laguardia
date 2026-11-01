import type { ChangeAiSettingsInput } from "@/modules/ai-assistance";
import type { FormFields } from "@/app/_actions/form-action";
import { versionSeen } from "@/app/_actions/version";

/**
 * The form „KI“'s own fields (ST-104). `keyOffered` says the form had its key field – so a rejection shows it again –,
 * `key` is a secret: read, never sent back (G36).
 */
export const aiSettingsFormFields = ["version", "keyOffered", "key", "chatModel", "embeddingModel"] as const;

export type AiSettingsFormField = (typeof aiSettingsFormFields)[number];

/** Reads the form „KI“ (Q19): the key as typed, a model chosen or typed – a part not sent is "no value given". */
export function aiSettingsFormInput(fields: FormFields<AiSettingsFormField>): ChangeAiSettingsInput {
  return {
    version: versionSeen(fields.version),
    key: fields.key ?? "",
    chatModel: fields.chatModel || undefined,
    embeddingModel: fields.embeddingModel || undefined,
  };
}

/** How the form „KI“ is read (ST-104) – what its Server Action runs and its tests post through. */
export const aiSettingsFormDefinition = {
  fields: aiSettingsFormFields,
  secret: ["key"] as readonly AiSettingsFormField[],
  input: aiSettingsFormInput,
};

/**
 * Where a save of the form „KI“ lands (ST-110): „Schlüssel ersetzt.“ when a new key was typed into „Neuer
 * API-Schlüssel“ (the field after „Ersetzen“), otherwise „KI gespeichert.“.
 */
export function aiSaveLanding(formData: FormData): { keyTyped: boolean; landing: "saved" | "key-replaced" } {
  const keyTyped = String(formData.get("key") ?? "").trim() !== "";
  return { keyTyped, landing: keyTyped && formData.get("keyOffered") === "replace" ? "key-replaced" : "saved" };
}

/** The fields of the confirmation „Embedding-Modell wechseln“ on the warning page (ST-110) – never a key. */
export const confirmEmbeddingModelFields = ["version", "chatModel", "embeddingModel"] as const;

export type ConfirmEmbeddingModelField = (typeof confirmEmbeddingModelFields)[number];

/** „Embedding-Modell wechseln“ (ST-110): the models chosen on the form „KI“, at the version it showed, confirmed. */
export const confirmEmbeddingModelDefinition = {
  fields: confirmEmbeddingModelFields,
  input: (fields: FormFields<ConfirmEmbeddingModelField>): ChangeAiSettingsInput => ({
    version: versionSeen(fields.version),
    key: "",
    chatModel: fields.chatModel || undefined,
    embeddingModel: fields.embeddingModel || undefined,
    embeddingModelConfirmed: true,
  }),
} as const;

/** What the form „KI“ chose that a page passes on in its address – the models, never the key (G36). */
export type ChosenModels = { version?: string; chatModel?: string; embeddingModel?: string };

function withChosen(path: string, chosen: ChosenModels): string {
  const params = new URLSearchParams();
  for (const name of ["version", "chatModel", "embeddingModel"] as const) {
    const value = chosen[name];
    if (value) params.set(name, value);
  }
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

/** The warning before the embedding model changes (ST-110): a page of its own, so it works without JavaScript. */
export const EMBEDDING_MODEL_CHANGE_PAGE = "/team/museum-settings/embedding-modell-wechseln";

export function embeddingModelChangeAddress(chosen: ChosenModels): string {
  return withChosen(EMBEDDING_MODEL_CHANGE_PAGE, chosen);
}

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
  return embeddingModelChangeAddress({ version, chatModel, embeddingModel });
}

/** „Entfernen“ (ST-104): one tap, the version the page showed. */
export const removeAiKeyDefinition = {
  fields: ["version"],
  input: (fields: FormFields<"version">): ChangeAiSettingsInput => ({
    version: versionSeen(fields.version),
    key: "",
    removeKey: true,
  }),
} as const;
