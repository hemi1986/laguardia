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

/** „Entfernen“ (ST-104): one tap, the version the page showed. */
export const removeAiKeyDefinition = {
  fields: ["version"],
  input: (fields: FormFields<"version">): ChangeAiSettingsInput => ({
    version: versionSeen(fields.version),
    key: "",
    removeKey: true,
  }),
} as const;
