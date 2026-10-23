"use client";

import { useActionState, useId } from "react";
import { VersionField, keptKey } from "@/app/_actions/form-parts";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Rejection } from "@/components/ui/message";
import { teamMessages } from "@/platform/messages";
import { rejectionText } from "@/app/_actions/rejection-text";
import { MaintenanceTaskFields, fieldOf, type Choices } from "../maintenance-task-fields";
import { addMaintenanceTaskAction } from "./actions";

const { maintenancePlan: texts } = teamMessages;

/**
 * The form „Wartungsaufgabe hinzufügen“ (ST-040): the name, then the details every maintenance task has (shared with
 * changing one, ST-041). The command rejects a restriction that does not fit with its own reason. A rejection keeps
 * every value, names the reason above the submit button and marks the field that caused it (G8).
 */
export function AddMaintenanceTaskForm({ version, ...choices }: Choices & { version: number }) {
  const [state, action, pending] = useActionState(addMaintenanceTaskAction, null);
  const rejectionId = useId();
  const kept = keptKey(state);
  const nameInvalid = state ? fieldOf[state.error] === "name" : false;

  return (
    <form action={action} className="flex flex-col gap-5">
      <VersionField version={version} />
      <Field data-invalid={nameInvalid}>
        <FieldLabel htmlFor="name">{texts.name}</FieldLabel>
        <Input
          id="name"
          name="name"
          defaultValue={state?.values.name}
          key={`name-${kept}`}
          required
          aria-invalid={nameInvalid || undefined}
          aria-describedby={nameInvalid ? rejectionId : undefined}
        />
      </Field>
      <MaintenanceTaskFields
        values={{ ...state?.values, suitableForHelpers: state ? state.values.suitableForHelpers !== "" : false }}
        kept={kept}
        error={state?.error}
        rejectionId={rejectionId}
        {...choices}
      />
      {state && (
        <div id={rejectionId}>
          <Rejection>{rejectionText(state.error)}</Rejection>
        </div>
      )}
      <Button type="submit" disabled={pending}>
        {texts.add}
      </Button>
    </form>
  );
}
