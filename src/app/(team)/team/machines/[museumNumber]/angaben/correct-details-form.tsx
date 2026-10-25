"use client";

import { useActionState, useId } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Rejection } from "@/components/ui/message";
import { teamMessages } from "@/platform/messages";
import { rejectionText } from "@/app/_actions/rejection-text";
import { VersionField, keptKey } from "@/app/_actions/form-parts";
import { correctDetailsAction } from "./actions";

const { terms, machineCorrection: texts } = teamMessages;

/**
 * The correction form (ST-035): the museum number and the serial number, filled in with the current ones. A rejection
 * keeps the typed text and marks the museum number when it is the museum number's fault (G8), with and without
 * JavaScript.
 */
export function CorrectDetailsForm({
  machineId,
  version,
  museumNumber,
  serialNumber,
}: {
  machineId: string;
  version: number;
  museumNumber: string;
  serialNumber: string;
}) {
  const [state, action, pending] = useActionState(correctDetailsAction, null);
  const rejectionId = useId();
  const museumNumberHintId = useId();
  const serialNumberHintId = useId();
  const invalid = state?.error === "museum-number-format" || state?.error === "museum-number-taken";
  const typedMuseumNumber = state?.values.museumNumber ?? museumNumber;

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="machineId" value={machineId} />
      <VersionField version={version} />
      <Field data-invalid={invalid || undefined}>
        <FieldLabel htmlFor="museumNumber">{terms["Museum number"]}</FieldLabel>
        <Input
          id="museumNumber"
          name="museumNumber"
          defaultValue={typedMuseumNumber}
          key={`museumNumber-${keptKey(state)}`}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? `${rejectionId} ${museumNumberHintId}` : museumNumberHintId}
        />
        <FieldDescription id={museumNumberHintId}>{texts.museumNumberHint}</FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor="serialNumber">{terms["Serial number"]}</FieldLabel>
        <Input
          id="serialNumber"
          name="serialNumber"
          defaultValue={state?.values.serialNumber ?? serialNumber}
          key={`serialNumber-${keptKey(state)}`}
          aria-describedby={serialNumberHintId}
        />
        <FieldDescription id={serialNumberHintId}>{texts.serialNumberHint}</FieldDescription>
      </Field>
      {state && (
        <div id={rejectionId}>
          <Rejection>
            {rejectionText(state.error, {
              "museum-number-format": texts.museumNumberFormat,
              "museum-number-taken": texts.museumNumberTaken(typedMuseumNumber.trim()),
            })}
          </Rejection>
        </div>
      )}
      <Button type="submit" disabled={pending}>
        {texts.submit}
      </Button>
    </form>
  );
}
