"use client";

import { useActionState, useId } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Rejection } from "@/components/ui/message";
import { Textarea } from "@/components/ui/textarea";
import { commandErrorText, teamMessages, type TeamCommandErrorCode } from "@/platform/messages";
import type { ResolveDefectState } from "./actions";
import { VersionField, keptKey } from "@/app/_actions/form-parts";

const { defects: texts, terms } = teamMessages;

/**
 * The form „Defekt beheben“ (ST-028): only the closing note. A rejection keeps the note and marks its field when the
 * note is the reason (G8), with and without JavaScript. A defect this team member could not resolve when the page
 * loaded shows the reason instead of a form – but one that changed while they typed keeps the form, the note and the
 * rejection.
 */
export function ResolveDefectForm({
  action: resolve,
  version,
  whyNot,
}: {
  action: (previous: ResolveDefectState, formData: FormData) => Promise<ResolveDefectState>;
  version: number;
  /** Why the team member may not resolve the defect as it is now – CMD-ResolveDefect's own reason (G11). */
  whyNot: TeamCommandErrorCode | undefined;
}) {
  const [state, action, pending] = useActionState(resolve, null);
  const rejectionId = useId();
  if (whyNot && !state) return <p>{commandErrorText(teamMessages, whyNot)}</p>;
  const kept = keptKey(state);
  const invalid = state?.error === "closing-note-required";

  return (
    <form action={action} className="flex flex-col gap-5">
      <VersionField version={version} />
      <Field data-invalid={invalid}>
        <FieldLabel htmlFor="closingNote">{terms["Closing note"]}</FieldLabel>
        <Textarea
          id="closingNote"
          name="closingNote"
          rows={3}
          defaultValue={state?.values.closingNote}
          key={`closingNote-${kept}`}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? rejectionId : undefined}
        />
      </Field>
      {state && (
        <div id={rejectionId}>
          <Rejection>{commandErrorText(teamMessages, state.error)}</Rejection>
        </div>
      )}
      <Button type="submit" disabled={pending}>
        {texts.resolveSubmit}
      </Button>
    </form>
  );
}
