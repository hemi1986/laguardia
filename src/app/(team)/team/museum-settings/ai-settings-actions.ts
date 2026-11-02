"use server";

import { redirect } from "next/navigation";
import { aiDependencies, changeAiSettingsCommand } from "@/modules/ai-assistance";
import { formAction, type FormState } from "@/app/_actions/form-action";
import type { CommandError } from "@/platform/command";
import { requireTechnician } from "../../../team-session";
import {
  aiSettingsFormDefinition,
  confirmEmbeddingModelDefinition,
  removeAiKeyDefinition,
  type AiSettingsFormField,
  type ConfirmEmbeddingModelField,
} from "./ai-settings-form-input";
import { aiLanding } from "./ai-settings-data";
import { whereASaveGoes } from "./embedding-modell-wechseln/embedding-model-change-address";

type AiSettingsError = CommandError<ReturnType<typeof changeAiSettingsCommand>>;

export type AiSettingsFormState = FormState<AiSettingsError, AiSettingsFormField>;
export type RemoveAiKeyState = FormState<AiSettingsError, "version">;
export type ConfirmEmbeddingModelState = FormState<AiSettingsError, ConfirmEmbeddingModelField>;

const command = changeAiSettingsCommand(aiDependencies());

/**
 * CMD-ChangeAiSettings from the form „KI“ (ST-104) – through the Server Action runner; the command asks OpenRouter
 * through the AI seam before it decides. The key is never sent back (`secret`). Afterwards the technician is on the
 * same page with the confirmation (G3) – „Schlüssel ersetzt.“ after „Ersetzen“ (ST-110). The runner starts the AI index
 * work once a change has committed (POL-AiIndexFollowsTheSettings, ST-106); a save without a change starts none. Where
 * it goes depends on what was posted as well, which `onSuccess` does not get, so `saveAiSettingsAction` redirects.
 */
const saveAiSettings = formAction(command, { ...aiSettingsFormDefinition, onSuccess: async () => {} });

/** „Embedding-Modell wechseln“ on the warning (ST-110): the change confirmed – every file is indexed again. */
const confirmEmbeddingModel = formAction(command, {
  ...confirmEmbeddingModelDefinition,
  onSuccess: async () => redirect(aiLanding("saved")),
});

/** „Entfernen“ – one tap, no question first (user, 2026-10-31): the key can be saved again. */
const removeAiKey = formAction(command, {
  ...removeAiKeyDefinition,
  onSuccess: async () => redirect(aiLanding("key-removed")),
});

export async function saveAiSettingsAction(
  previous: AiSettingsFormState,
  formData: FormData,
): Promise<AiSettingsFormState> {
  await requireTechnician(); // the page's access check; who may run the command is decided by its allowedActors
  const state = await saveAiSettings(previous, formData);
  const next = whereASaveGoes(state, formData);
  if (next) redirect(next);
  return state;
}

export async function confirmEmbeddingModelAction(
  previous: ConfirmEmbeddingModelState,
  formData: FormData,
): Promise<ConfirmEmbeddingModelState> {
  await requireTechnician();
  return confirmEmbeddingModel(previous, formData);
}

export async function removeAiKeyAction(previous: RemoveAiKeyState, formData: FormData): Promise<RemoveAiKeyState> {
  await requireTechnician();
  return removeAiKey(previous, formData);
}
