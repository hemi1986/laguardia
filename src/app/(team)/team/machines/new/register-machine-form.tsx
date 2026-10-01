"use client";

import { useActionState, useId } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Rejection } from "@/components/ui/message";
import { NativeSelect } from "@/components/ui/native-select";
import type { MachineStatus } from "@/modules/collection";
import { commandErrorText, teamMessages } from "@/platform/messages";
import { registerMachineAction, type RegisterMachineState } from "./actions";
import type { RegisterMachineField } from "./register-machine-input";

const { machines: texts, terms } = teamMessages;

/** What the two selects offer – built by the page, so the client imports no module code (only erased types). */
export type Choices = {
  machineModels: { value: string; label: string }[];
  machineStatuses: { value: MachineStatus; label: string }[];
};

type Rejected = NonNullable<RegisterMachineState>["error"];

/** The field that caused a rejection – marked at the form (G8). The others have no field of their own. */
const fieldOf: Partial<Record<Rejected, RegisterMachineField>> = {
  "machine-model-required": "machineModelId",
  "location-required": "location",
  "machine-status-required": "machineStatus",
  "museum-number-format": "museumNumber",
  "museum-number-taken": "museumNumber",
  "no-museum-number-free": "museumNumber",
};

/**
 * The registration form (ST-007), the first form on shadcn's Field (G8, G9): a rejection keeps every value, names the
 * reason above the submit button and marks the field that caused it – with and without JavaScript (ST-073).
 */
export function RegisterMachineForm({ machineModels, machineStatuses }: Choices) {
  const [state, action, pending] = useActionState(registerMachineAction, null);
  const rejectionId = useId();
  const kept = state ? JSON.stringify(state) : "empty";
  const invalid = state ? fieldOf[state.error] : undefined;
  /** Marks a field as the cause of the rejection and links it to the reason, next to its own hint if it has one. */
  const marked = (field: RegisterMachineField, hint?: string) => {
    const describedBy = [hint, invalid === field ? rejectionId : undefined].filter(Boolean).join(" ");
    return { "aria-invalid": invalid === field || undefined, "aria-describedby": describedBy || undefined };
  };

  return (
    <form action={action} className="flex flex-col gap-5">
      <Field data-invalid={invalid === "machineModelId"}>
        <FieldLabel htmlFor="machineModelId">{terms["Machine model"]}</FieldLabel>
        <NativeSelect
          id="machineModelId"
          name="machineModelId"
          defaultValue={state?.values.machineModelId ?? ""}
          key={`machineModelId-${kept}`}
          required
          {...marked("machineModelId")}
        >
          <option value="">{texts.choose}</option>
          {machineModels.map((model) => (
            <option key={model.value} value={model.value}>
              {model.label}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field data-invalid={invalid === "museumNumber"}>
        <FieldLabel htmlFor="museumNumber">{terms["Museum number"]}</FieldLabel>
        <Input
          id="museumNumber"
          name="museumNumber"
          placeholder="LG-042"
          defaultValue={state?.values.museumNumber}
          key={`museumNumber-${kept}`}
          {...marked("museumNumber", "museumNumber-hint")}
        />
        <FieldDescription id="museumNumber-hint">{texts.museumNumberHint}</FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor="serialNumber">{terms["Serial number"]}</FieldLabel>
        <Input
          id="serialNumber"
          name="serialNumber"
          defaultValue={state?.values.serialNumber}
          key={`serialNumber-${kept}`}
          {...marked("serialNumber", "serialNumber-hint")}
        />
        <FieldDescription id="serialNumber-hint">{texts.serialNumberHint}</FieldDescription>
      </Field>
      <Field data-invalid={invalid === "location"}>
        <FieldLabel htmlFor="location">{terms.Location}</FieldLabel>
        <Input
          id="location"
          name="location"
          defaultValue={state?.values.location}
          key={`location-${kept}`}
          required
          {...marked("location")}
        />
      </Field>
      <Field data-invalid={invalid === "machineStatus"}>
        <FieldLabel htmlFor="machineStatus">{texts.status}</FieldLabel>
        <NativeSelect
          id="machineStatus"
          name="machineStatus"
          defaultValue={state?.values.machineStatus ?? "playable"}
          key={`machineStatus-${kept}`}
          required
          {...marked("machineStatus")}
        >
          {machineStatuses.map((status) => (
            <option key={status.value} value={status.value}>
              {status.label}
            </option>
          ))}
        </NativeSelect>
      </Field>
      {state && (
        <div id={rejectionId}>
          <Rejection>{commandErrorText(teamMessages, state.error)}</Rejection>
        </div>
      )}
      <Button type="submit" disabled={pending}>
        {texts.register}
      </Button>
    </form>
  );
}
