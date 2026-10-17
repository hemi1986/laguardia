"use client";

import { useActionState, useId } from "react";
import { VersionField, keptKey } from "@/app/_actions/form-parts";
import { rejectionText } from "@/app/_actions/rejection-text";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Rejection } from "@/components/ui/message";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { HoldReason } from "@/modules/repair";
import { commandErrorText, teamMessages, type TeamCommandErrorCode } from "@/platform/messages";
import type { PutDefectOnHoldState } from "./actions";

const { defects: texts } = teamMessages;

/**
 * The form „Defekt pausieren“ (ST-029): the reason – in glossary order, none preselected (G20), a native select so it
 * works without JavaScript – and an optional note. A rejection keeps both and marks the reason when it is missing (G8).
 * Someone who could not put the defect on hold when the page loaded sees the reason instead of a form – but a defect
 * that changed while they chose keeps the form and the rejection.
 */
export function PutDefectOnHoldForm({
  action: putOnHold,
  version,
  reasons,
  whyNot,
}: {
  action: (previous: PutDefectOnHoldState, formData: FormData) => Promise<PutDefectOnHoldState>;
  version: number;
  /** The reasons to choose from, in glossary order (G20) – from the page, so the client takes no server code. */
  reasons: readonly HoldReason[];
  /** Why the team member may not put the defect on hold as it is now – CMD-PutDefectOnHold's own reason (G11). */
  whyNot: TeamCommandErrorCode | undefined;
}) {
  const [state, action, pending] = useActionState(putOnHold, null);
  const rejectionId = useId();
  if (whyNot && !state) return <p>{commandErrorText(teamMessages, whyNot)}</p>;
  const kept = keptKey(state);
  const invalid = state?.error === "hold-reason-required";

  return (
    <form action={action} className="flex flex-col gap-5">
      <VersionField version={version} />
      <Field data-invalid={invalid}>
        <FieldLabel htmlFor="reason">{texts.holdReason}</FieldLabel>
        <NativeSelect
          id="reason"
          name="reason"
          defaultValue={state?.values.reason ?? ""}
          key={`reason-${kept}`}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? rejectionId : undefined}
        >
          <option value="">{texts.holdReasonChoose}</option>
          {reasons.map((reason) => (
            <option key={reason} value={reason}>
              {texts.holdReasons[reason]}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field>
        <FieldLabel htmlFor="note">{texts.holdNote}</FieldLabel>
        <Textarea id="note" name="note" rows={2} defaultValue={state?.values.note} key={`note-${kept}`} />
      </Field>
      {state && (
        <div id={rejectionId}>
          <Rejection>{rejectionText(state.error)}</Rejection>
        </div>
      )}
      <Button type="submit" disabled={pending}>
        {texts.putOnHold}
      </Button>
    </form>
  );
}
