"use server";

import { redirect } from "next/navigation";
import { aiDependencies, changeAiSettingsCommand } from "@/modules/ai-assistance";
import { formAction, type FormState } from "@/app/_actions/form-action";
import { startAiWorkAfterResponse } from "@/app/ai-work";
import type { CommandError } from "@/platform/command";
import { requireTechnician } from "../../../team-session";
import { aiSettingsFormDefinition, removeAiKeyDefinition, type AiSettingsFormField } from "./ai-settings-form-input";
import { aiLanding } from "./ai-settings-data";

type AiSettingsError = CommandError<ReturnType<typeof changeAiSettingsCommand>>;

export type AiSettingsFormState = FormState<AiSettingsError, AiSettingsFormField>;
export type RemoveAiKeyState = FormState<AiSettingsError, "version">;

const command = changeAiSettingsCommand(aiDependencies());

/**
 * CMD-ChangeAiSettings from the form „KI“ (ST-104) – through the Server Action runner; the command asks OpenRouter
 * through the AI seam before it decides. The key is never sent back (`secret`). Afterwards the technician is on the
 * same page with the confirmation (G3). A save that turned AI on or changed the embedding model starts the AI index
 * work after the response (POL-AiIndexFollowsTheSettings, ST-106); a save without a change is harmless – a run finds
 * no waiting file when nothing changed.
 */
const saveAiSettings = formAction(command, {
  ...aiSettingsFormDefinition,
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
  return saveAiSettings(previous, formData);
}

export async function removeAiKeyAction(previous: RemoveAiKeyState, formData: FormData): Promise<RemoveAiKeyState> {
  await requireTechnician();
  return removeAiKey(previous, formData);
}
