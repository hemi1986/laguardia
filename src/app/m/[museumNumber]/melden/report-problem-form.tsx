"use client";

import { useActionState, useId } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Rejection } from "@/components/ui/message";
import { Textarea } from "@/components/ui/textarea";
import { commandErrorText, type VisitorMessages } from "@/platform/messages";
import type { ReportProblemState } from "./actions";

/**
 * The report form (ST-013): the description and nothing else – no name, no e-mail address, no account. A rejection
 * keeps the description, names the reason above the button and marks the field (G8), with and without JavaScript.
 */
export function ReportProblemForm({
  action: report,
  machineId,
  messages,
}: {
  action: (previous: ReportProblemState, formData: FormData) => Promise<ReportProblemState>;
  machineId: string;
  /** Only the strings the form shows – a client component gets no functions from the catalogue. */
  messages: Pick<VisitorMessages, "reportForm" | "commandErrors">;
}) {
  const [state, action, pending] = useActionState(report, null);
  const rejectionId = useId();
  const texts = messages.reportForm;
  const kept = state ? JSON.stringify(state) : "empty";
  // Every rejection of this form is about the description, except the machine's own (not on display, unknown).
  const invalid = state?.error === "description-required" || state?.error === "description-too-long";

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="machineId" value={machineId} />
      <Field data-invalid={invalid}>
        <FieldLabel htmlFor="description">{texts.description}</FieldLabel>
        <Textarea
          id="description"
          name="description"
          rows={5}
          defaultValue={state?.values.description}
          key={`description-${kept}`}
          aria-invalid={invalid || undefined}
          aria-describedby={["description-hint", invalid ? rejectionId : undefined].filter(Boolean).join(" ")}
        />
        <FieldDescription id="description-hint">{texts.descriptionHint}</FieldDescription>
      </Field>
      {state && (
        <div id={rejectionId}>
          <Rejection>{commandErrorText(messages, state.error)}</Rejection>
        </div>
      )}
      <Button type="submit" disabled={pending}>
        {texts.send}
      </Button>
    </form>
  );
}
