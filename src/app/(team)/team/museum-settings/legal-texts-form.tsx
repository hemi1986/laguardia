"use client";

import { useActionState, useId } from "react";
import { VersionField, keptKey } from "@/app/_actions/form-parts";
import { rejectionText } from "@/app/_actions/rejection-text";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Rejection } from "@/components/ui/message";
import { Textarea } from "@/components/ui/textarea";
import { teamMessages } from "@/platform/messages";
import { saveLegalTextsAction, type LegalTextsFormState } from "./legal-texts-actions";
import type { LegalTextsFormField } from "./legal-texts-form-input";

const { legalTexts: texts } = teamMessages.museumSettings;

type TextField = Exclude<LegalTextsFormField, "version">;

type LegalTextsFormProps = { version: number; texts: Record<TextField, string> };

/** The four texts in the form's order, each with its label and the number of lines it starts with. */
const textFields: { field: TextField; rows: number }[] = [
  { field: "privacyNoticeDe", rows: 12 },
  { field: "privacyNoticeEn", rows: 12 },
  { field: "imprintDe", rows: 6 },
  { field: "imprintEn", rows: 6 },
];

/** The field a rejection names (G9) – the others are about the whole form (a change made meanwhile). */
const reasonAtField: Partial<Record<NonNullable<LegalTextsFormState>["error"], TextField>> = {
  "privacy-notice-required": "privacyNoticeDe",
  "english-imprint-needs-german-imprint": "imprintEn",
};

/**
 * The form „Rechtstexte“ of the museum settings (ST-103): the privacy notice and the imprint in German and English as
 * Markdown, saved on its own. Native text areas only, so it works without JavaScript.
 */
export function LegalTextsForm(props: LegalTextsFormProps) {
  const [state, action, pending] = useActionState(saveLegalTextsAction, null);
  return <LegalTextsFormContent {...props} state={state} action={action} pending={pending} />;
}

/**
 * The form as it looks in an action state: a rejection keeps all four texts as typed and names the reason at the field
 * that caused it, else at the end of the form (G8, G9).
 */
export function LegalTextsFormContent({
  version,
  texts: current,
  state,
  action,
  pending = false,
}: LegalTextsFormProps & { state: LegalTextsFormState; action?: (formData: FormData) => void; pending?: boolean }) {
  const rejectionId = useId();
  const kept = keptKey(state);
  const invalid = state ? reasonAtField[state.error] : undefined;
  const rejection = state && (
    <div id={rejectionId}>
      <Rejection>{rejectionText(state.error)}</Rejection>
    </div>
  );

  return (
    <form action={action} className="flex flex-col gap-5">
      <VersionField version={version} />
      <p className="text-muted-foreground text-sm" id="legal-texts-hint">
        {texts.markdownHint}
      </p>
      {textFields.map(({ field, rows }) => (
        <Field key={field} data-invalid={invalid === field}>
          <FieldLabel htmlFor={field}>{texts[field]}</FieldLabel>
          <Textarea
            key={`${field}-${kept}`}
            id={field}
            name={field}
            rows={rows}
            defaultValue={state ? (state.values[field] ?? "") : current[field]}
            required={field === "privacyNoticeDe"}
            aria-invalid={invalid === field || undefined}
            aria-describedby={invalid === field ? `${rejectionId} legal-texts-hint` : "legal-texts-hint"}
          />
          {invalid === field && rejection}
        </Field>
      ))}
      {!invalid && rejection}
      <Button type="submit" disabled={pending}>
        {texts.save}
      </Button>
    </form>
  );
}
