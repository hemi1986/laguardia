"use client";

import { useActionState, useId } from "react";
import { VersionField, keptKey } from "@/app/_actions/form-parts";
import { rejectionText } from "@/app/_actions/rejection-text";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Rejection } from "@/components/ui/message";
import { NativeSelect } from "@/components/ui/native-select";
import { commandErrorText, teamMessages } from "@/platform/messages";
import {
  removeAiKeyAction,
  saveAiSettingsAction,
  type AiSettingsFormState,
  type RemoveAiKeyState,
} from "./ai-settings-actions";

const { aiSettings: texts } = teamMessages;

/** A model in the choice: its ID and the entry the list shows („… · passt nicht“ for one that does not fit). */
export type ModelOption = { id: string; entry: string; fits: boolean };

/** One model field: the saved model, if any, and how one is chosen – from OpenRouter's list, or typed. */
export type ModelField = { saved: string | undefined; choose: ModelOption[] | "typed" };

export type AiSettingsFormProps = {
  version: number;
  keySaved: boolean;
  chatModel: ModelField;
  embeddingModel: ModelField;
};

type Part = "key" | "chatModel" | "embeddingModel";

/** At which field a rejection is said (G8, G9) – the rest under the form. */
function partOf(error: NonNullable<AiSettingsFormState>["error"]): Part | undefined {
  if (error === "ai-key-refused") return "key";
  if (error.startsWith("chat-model-")) return "chatModel";
  if (error.startsWith("embedding-model-")) return "embeddingModel";
  return undefined;
}

/**
 * The form „KI“ (ST-104): the parts that are not saved yet – the key, the chat model, the embedding model – saved
 * together with „KI speichern“. A saved part is not offered for a change until ST-110. After a rejection the parts the
 * technician sent stay, with the models as chosen and the key field empty (G36), also when someone saved them meanwhile.
 */
export function AiSettingsForm(props: AiSettingsFormProps) {
  const [state, action, pending] = useActionState(saveAiSettingsAction, null);
  return <AiSettingsFormContent {...props} state={state} action={action} pending={pending} />;
}

export function AiSettingsFormContent({
  version,
  keySaved,
  chatModel,
  embeddingModel,
  state,
  action,
  pending = false,
}: AiSettingsFormProps & {
  state: AiSettingsFormState;
  action?: (formData: FormData) => void;
  pending?: boolean;
}) {
  const rejectionId = useId();
  const kept = keptKey(state);
  const invalid = state ? partOf(state.error) : undefined;
  const showKey = !keySaved || !!state?.values.keyOffered;
  const showChat = !chatModel.saved || !!state?.values.chatModel;
  const showEmbedding = !embeddingModel.saved || !!state?.values.embeddingModel;
  if (!showKey && !showChat && !showEmbedding) return null;

  const rejection = state && (
    <div id={rejectionId}>
      <Rejection>{rejectionText(state.error)}</Rejection>
    </div>
  );
  const at = (part: Part) => (invalid === part ? rejection : null);
  const fieldProps = (part: Part) => ({
    "aria-invalid": invalid === part || undefined,
    "aria-describedby": invalid === part ? rejectionId : undefined,
  });

  const modelField = (part: "chatModel" | "embeddingModel", label: string, model: ModelField) => (
    <Field data-invalid={invalid === part}>
      <FieldLabel htmlFor={part}>{label}</FieldLabel>
      {model.choose === "typed" ? (
        <Input
          id={part}
          name={part}
          defaultValue={state?.values[part] ?? ""}
          key={`${part}-${kept}`}
          placeholder={part === "chatModel" ? "google/gemini-2.5-flash" : "google/gemini-embedding-2"}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          {...fieldProps(part)}
        />
      ) : (
        <NativeSelect
          id={part}
          name={part}
          defaultValue={state?.values[part] ?? ""}
          key={`${part}-${kept}`}
          {...fieldProps(part)}
        >
          <option value="">{texts.chooseModel}</option>
          {model.choose.map((option) => (
            <option key={option.id} value={option.id} disabled={!option.fits}>
              {option.entry}
            </option>
          ))}
        </NativeSelect>
      )}
      {at(part)}
    </Field>
  );

  return (
    <form action={action} className="flex flex-col gap-5">
      <VersionField version={version} />
      {showKey && (
        <Field data-invalid={invalid === "key"}>
          <input type="hidden" name="keyOffered" value="1" />
          <FieldLabel htmlFor="key">{texts.key}</FieldLabel>
          <Input
            id="key"
            name="key"
            type="password"
            autoComplete="off"
            key={`key-${kept}`}
            spellCheck={false}
            {...fieldProps("key")}
          />
          {at("key")}
        </Field>
      )}
      {showChat && modelField("chatModel", texts.chatModel, chatModel)}
      {showEmbedding && modelField("embeddingModel", texts.embeddingModel, embeddingModel)}
      {!invalid && rejection}
      <Button type="submit" disabled={pending}>
        {texts.save}
      </Button>
    </form>
  );
}

/** „Entfernen“ next to the saved key – one tap, no question page (user, 2026-10-31). */
export function RemoveAiKeyForm({ version }: { version: number }) {
  const [state, action, pending] = useActionState<RemoveAiKeyState, FormData>(removeAiKeyAction, null);
  return (
    <form action={action} className="flex flex-col gap-2">
      <VersionField version={version} />
      <Button type="submit" variant="outline" disabled={pending} className="self-start">
        {texts.removeKey}
      </Button>
      {state && <Rejection>{commandErrorText(teamMessages, state.error)}</Rejection>}
    </form>
  );
}
