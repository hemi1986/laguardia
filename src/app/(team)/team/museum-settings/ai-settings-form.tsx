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

/**
 * One model field: the saved model's name, if any, its ID – what the field holds until another is chosen (ST-110) –,
 * and how one is chosen – from OpenRouter's list, or typed.
 */
export type ModelField = { saved: string | undefined; savedId: string | undefined; choose: ModelOption[] | "typed" };

export type AiSettingsFormProps = {
  version: number;
  keySaved: boolean;
  /** „Ersetzen“ was tapped: the field „Neuer API-Schlüssel“ is offered (ST-110). */
  replacingKey?: boolean;
  chatModel: ModelField;
  embeddingModel: ModelField;
  /** The models chosen before the warning about the embedding model, coming back with „Zurück“ (G10b). */
  chosen?: { chatModel?: string; embeddingModel?: string };
};

type Part = "key" | "chatModel" | "embeddingModel";

/** At which field a rejection is said (G8, G9) – the rest under the form. */
function partOf(error: NonNullable<AiSettingsFormState>["error"]): Part | undefined {
  // „Bitte den neuen Schlüssel zuerst allein speichern …“ is about the key (code review ST-110).
  if (error === "ai-key-refused" || error === "embedding-model-change-unconfirmed") return "key";
  if (error.startsWith("chat-model-")) return "chatModel";
  if (error.startsWith("embedding-model-")) return "embeddingModel";
  return undefined;
}

/**
 * The form „KI“ (ST-104, ST-110): the key while none is saved – or „Neuer API-Schlüssel“ after „Ersetzen“ –, and the
 * chat model and the embedding model, each holding the saved one until another is chosen; saved together with „KI
 * speichern“, so a save without a change records nothing (HS-27). After a rejection the parts the technician sent stay,
 * with the models as chosen and the key field empty (G36), also when someone saved them meanwhile.
 */
export function AiSettingsForm(props: AiSettingsFormProps) {
  const [state, action, pending] = useActionState(saveAiSettingsAction, null);
  return <AiSettingsFormContent {...props} state={state} action={action} pending={pending} />;
}

export function AiSettingsFormContent({
  version,
  keySaved,
  replacingKey = false,
  chatModel,
  embeddingModel,
  chosen = {},
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
  const showKey = !keySaved || replacingKey || !!state?.values.keyOffered;
  // „Neuer API-Schlüssel“ while a key is saved – after a rejection too, which keeps `keyOffered` as it was posted.
  const replacing = keySaved && (replacingKey || state?.values.keyOffered === "replace");
  const shown: Record<Part, boolean> = { key: showKey, chatModel: true, embeddingModel: true };
  // At its field when the form shows that field – a saved key refused by the test embedding is said under the form.
  const part = state ? partOf(state.error) : undefined;
  const invalid = part && shown[part] ? part : undefined;

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

  const modelField = (part: "chatModel" | "embeddingModel", label: string, model: ModelField) => {
    // What was sent, else what was chosen before the warning, else the saved model (ST-110).
    const value = state ? state.values[part] : (chosen[part] ?? model.savedId ?? "");
    return (
      <Field data-invalid={invalid === part}>
        <FieldLabel htmlFor={part}>{label}</FieldLabel>
        {model.choose === "typed" ? (
          <Input
            id={part}
            name={part}
            defaultValue={value}
            key={`${part}-${kept}`}
            placeholder={part === "chatModel" ? "google/gemini-2.5-flash" : "google/gemini-embedding-2"}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            {...fieldProps(part)}
          />
        ) : (
          <NativeSelect id={part} name={part} defaultValue={value} key={`${part}-${kept}`} {...fieldProps(part)}>
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
  };

  return (
    <form action={action} className="flex flex-col gap-5">
      <VersionField version={version} />
      {showKey && (
        <Field data-invalid={invalid === "key"}>
          <input type="hidden" name="keyOffered" value={replacing ? "replace" : "1"} />
          <FieldLabel htmlFor="key">{replacing ? texts.newKey : texts.key}</FieldLabel>
          <Input
            id="key"
            name="key"
            type="password"
            // An API key, not this site's password – password managers must not offer to save it as the login.
            autoComplete="new-password"
            data-1p-ignore=""
            data-lpignore="true"
            key={`key-${kept}`}
            spellCheck={false}
            {...fieldProps("key")}
          />
          {at("key")}
        </Field>
      )}
      {modelField("chatModel", texts.chatModel, chatModel)}
      {modelField("embeddingModel", texts.embeddingModel, embeddingModel)}
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
