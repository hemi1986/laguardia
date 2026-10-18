"use client";

import { useActionState, useId } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Rejection } from "@/components/ui/message";
import { teamMessages } from "@/platform/messages";
import { rejectionText } from "@/app/_actions/rejection-text";
import { VersionField, keptKey } from "@/app/_actions/form-parts";
import { moveMachineAction } from "./actions";

const { terms, machineMove: texts } = teamMessages;

/**
 * The move form (ST-034): the location, filled in with the current one. A rejection keeps the typed text and marks
 * the field (G8), with and without JavaScript.
 */
export function MoveMachineForm({
  machineId,
  museumNumber,
  version,
  location,
}: {
  machineId: string;
  museumNumber: string;
  version: number;
  location: string;
}) {
  const [state, action, pending] = useActionState(moveMachineAction, null);
  const rejectionId = useId();
  const invalid = state && state.error !== "version-conflict" && state.error !== "machine-retired";
  const typed = state?.values.location ?? location;

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="machineId" value={machineId} />
      <VersionField version={version} />
      <Field data-invalid={invalid || undefined}>
        <FieldLabel htmlFor="location">{terms.Location}</FieldLabel>
        <Input
          id="location"
          name="location"
          defaultValue={typed}
          key={`location-${keptKey(state)}`}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? rejectionId : undefined}
        />
      </Field>
      {state && (
        <div id={rejectionId}>
          <Rejection>
            {rejectionText(state.error, { "location-unchanged": texts.unchanged(museumNumber, typed.trim()) })}
          </Rejection>
        </div>
      )}
      <Button type="submit" disabled={pending}>
        {texts.submit}
      </Button>
    </form>
  );
}
