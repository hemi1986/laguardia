"use client";

import { useActionState, useId } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Rejection } from "@/components/ui/message";
import { Textarea } from "@/components/ui/textarea";
import { teamMessages } from "@/platform/messages";
import { rejectionText } from "@/app/_actions/rejection-text";
import { VersionField, keptKey } from "@/app/_actions/form-parts";
import type { RetireMachineState } from "./actions";

const { machineRetire: texts } = teamMessages;

/**
 * The retire form (ST-039): the reason, then the question once, on its own (G10, G10b) – it says what will happen and
 * what nobody sees on this screen. „Zurück“ returns to the form with the reason kept and retires nothing. A rejection
 * keeps the typed reason and marks the field when it is the reason's fault (G8). A machine already retired when the
 * page loaded shows no form – but one retired while the technician typed keeps the form and the rejection.
 */
export function RetireMachineForm({
  action: retire,
  machineId,
  museumNumber,
  version,
  retired,
}: {
  action: (previous: RetireMachineState, formData: FormData) => Promise<RetireMachineState>;
  machineId: string;
  museumNumber: string;
  version: number;
  retired: boolean;
}) {
  const [state, action, pending] = useActionState(retire, null);
  const rejectionId = useId();
  if (retired && !state) return <p>{texts.retired}</p>;

  if (state?.asking) {
    return (
      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="machineId" value={machineId} />
        <VersionField version={version} />
        <input type="hidden" name="reason" value={state.values.reason} />
        <p className="font-medium" role="alert">
          {texts.question(museumNumber, state.openDefects, state.problemReports)}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" name="step" value="confirm" variant="destructive" disabled={pending}>
            {texts.confirm}
          </Button>
          <Button type="submit" name="step" value="back" variant="outline" disabled={pending}>
            {texts.back}
          </Button>
        </div>
      </form>
    );
  }

  const rejection = state?.error ? state : undefined;
  const invalid = rejection?.error === "reason-required";

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="machineId" value={machineId} />
      <VersionField version={version} />
      <Field data-invalid={invalid || undefined}>
        <FieldLabel htmlFor="reason">{texts.reason}</FieldLabel>
        <Textarea
          id="reason"
          name="reason"
          rows={3}
          defaultValue={state?.values.reason}
          key={`reason-${keptKey(state)}`}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? rejectionId : undefined}
        />
        <FieldDescription>{texts.reasonHint}</FieldDescription>
      </Field>
      {rejection && (
        <div id={rejectionId}>
          <Rejection>{rejectionText(rejection.error, { "reason-required": texts.reasonRequired })}</Rejection>
        </div>
      )}
      <Button type="submit" name="step" value="ask" disabled={pending}>
        {texts.submit}
      </Button>
    </form>
  );
}
