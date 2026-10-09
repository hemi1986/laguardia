"use client";

import Link from "next/link";
import { useActionState, useId } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Rejection } from "@/components/ui/message";
import { Textarea } from "@/components/ui/textarea";
import { teamMessages } from "@/platform/messages";
import type { DismissState } from "./actions";
import { triageRejectionText } from "../triage-rejection-text";

const { dismiss: texts, triage } = teamMessages;

/** The reasons in the order the form offers them, none preselected (story review 2026-10-03). */
const reasons = ["not-a-fault", "spam", "other"] as const;

/**
 * The form „Meldung verwerfen“ (ST-020, story review 2026-10-03): the reason as native radio buttons – they submit
 * without JavaScript – and the free text, always visible. Only spam asks first, once, naming what is deleted for good
 * (G10); „Zurück“ returns to the form with spam still chosen. A rejection keeps what was chosen and typed and marks
 * the field it is about (G8). A problem report already triaged when the page loaded shows no form – but one triaged
 * while the person chose keeps the form and the rejection.
 */
export function DismissForm({
  action: dismiss,
  version,
  triaged,
  museumNumber,
}: {
  action: (previous: DismissState, formData: FormData) => Promise<DismissState>;
  version: number;
  triaged: boolean;
  museumNumber: string;
}) {
  const [state, action, pending] = useActionState(dismiss, null);
  const rejectionId = useId();
  if (triaged && !state) return <p>{triage.alreadyTriaged}</p>;

  if (state?.asking) {
    return (
      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="version" value={version} />
        <input type="hidden" name="reason" value={state.values.reason} />
        <input type="hidden" name="reasonText" value={state.values.reasonText} />
        <p className="font-medium" role="alert">
          {texts.spamQuestion(museumNumber)}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" name="step" value="confirm" variant="destructive" disabled={pending}>
            {texts.confirmSpam}
          </Button>
          <Button type="submit" name="step" value="back" variant="outline" disabled={pending}>
            {texts.questionBack}
          </Button>
        </div>
      </form>
    );
  }

  const kept = state ? JSON.stringify(state) : "empty";
  const rejection = state?.error ? state : undefined;
  const invalid = rejection?.error;

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="version" value={version} />
      <FieldSet
        data-invalid={invalid === "dismissal-reason-required" || undefined}
        aria-describedby={invalid === "dismissal-reason-required" ? rejectionId : undefined}
      >
        <FieldLegend variant="label">{texts.reason}</FieldLegend>
        {reasons.map((reason) => (
          <label key={`${reason}-${kept}`} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="reason"
              value={reason}
              defaultChecked={state?.values.reason === reason}
              aria-invalid={invalid === "dismissal-reason-required" || undefined}
              className="size-4"
            />
            {texts.reasons[reason]}
          </label>
        ))}
      </FieldSet>
      <Field data-invalid={invalid === "dismissal-reason-text-required"}>
        <FieldLabel htmlFor="reasonText">{texts.reasonText}</FieldLabel>
        <Textarea
          id="reasonText"
          name="reasonText"
          rows={3}
          defaultValue={state?.values.reasonText}
          key={`reasonText-${kept}`}
          aria-invalid={invalid === "dismissal-reason-text-required" || undefined}
          aria-describedby={invalid === "dismissal-reason-text-required" ? rejectionId : undefined}
        />
      </Field>
      {rejection && (
        <div id={rejectionId} className="flex flex-col gap-2">
          <Rejection>{triageRejectionText(rejection)}</Rejection>
          {rejection.error === "already-triaged" && (
            <Link href="/team/triage" className="self-start text-sm underline underline-offset-4">
              {triage.back}
            </Link>
          )}
        </div>
      )}
      <Button type="submit" disabled={pending}>
        {texts.submit}
      </Button>
    </form>
  );
}
