"use server";

import { redirect } from "next/navigation";
import { aiDependencies, changeAiSettingsCommand } from "@/modules/ai-assistance";
import { formAction, type FormState } from "@/app/_actions/form-action";
import { startAiWorkAfterResponse } from "@/app/ai-work";
import type { CommandError } from "@/platform/command";
import { requireTechnician } from "../../../team-session";
import {
  aiSaveLanding,
  aiSettingsFormDefinition,
  confirmEmbeddingModelDefinition,
  embeddingModelWarning,
  removeAiKeyDefinition,
  type AiSettingsFormField,
  type ConfirmEmbeddingModelField,
} from "./ai-settings-form-input";
import { aiLanding } from "./ai-settings-data";

type AiSettingsError = CommandError<ReturnType<typeof changeAiSettingsCommand>>;

export type AiSettingsFormState = FormState<AiSettingsError, AiSettingsFormField>;
export type RemoveAiKeyState = FormState<AiSettingsError, "version">;
export type ConfirmEmbeddingModelState = FormState<AiSettingsError, ConfirmEmbeddingModelField>;

const command = changeAiSettingsCommand(aiDependencies());

/**
 * CMD-ChangeAiSettings from the form „KI“ (ST-104) – through the Server Action runner; the command asks OpenRouter
 * through the AI seam before it decides. The key is never sent back (`secret`). Afterwards the technician is on the
 * same page with the confirmation (G3) – „Schlüssel ersetzt.“ after „Ersetzen“ (ST-110). A save that turned AI on or
 * changed the embedding model starts the AI index work after the response (POL-AiIndexFollowsTheSettings, ST-106); a
 * save without a change is harmless – a run finds no waiting file when nothing changed.
 */
const saveAiSettings = (landing: "saved" | "key-replaced") =>
  formAction(command, {
    ...aiSettingsFormDefinition,
    onSuccess: async () => {
      startAiWorkAfterResponse();
      redirect(aiLanding(landing));
    },
  });

/** „Embedding-Modell wechseln“ on the warning (ST-110): the change confirmed – every file is indexed again. */
const confirmEmbeddingModel = formAction(command, {
  ...confirmEmbeddingModelDefinition,
  onSuccess: async () => {
    startAiWorkAfterResponse();
    redirect(aiLanding("saved"));
  },
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
  const { keyTyped, landing } = aiSaveLanding(formData);
  const state = await saveAiSettings(landing)(previous, formData);
  // A changed embedding model is asked about first, on a page of its own (ST-110).
  const warning = embeddingModelWarning(state, keyTyped);
  if (warning) redirect(warning);
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
