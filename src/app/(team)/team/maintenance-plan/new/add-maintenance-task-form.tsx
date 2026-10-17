"use client";

import { useActionState, useId } from "react";
import { VersionField, keptKey } from "@/app/_actions/form-parts";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Rejection } from "@/components/ui/message";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { teamMessages } from "@/platform/messages";
import { rejectionText } from "@/app/_actions/rejection-text";
import { addMaintenanceTaskAction, type AddMaintenanceTaskState } from "./actions";
import type { AddMaintenanceTaskField } from "./add-maintenance-task-input";

const { maintenancePlan: texts, terms } = teamMessages;

/** What the two selects offer – built by the page, so the client imports no module code. */
export type Choices = {
  machineCategories: { value: string; label: string }[];
  /** Every technology once, its label naming the machine categories it fits (as on the machine models' page). */
  technologies: { value: string; label: string }[];
};

type ErrorCode = NonNullable<AddMaintenanceTaskState>["error"];

/** The field that caused a rejection – marked at the form (G8). */
const fieldOf: Partial<Record<ErrorCode, AddMaintenanceTaskField>> = {
  "name-required": "name",
  "instruction-required": "instruction",
  "interval-not-positive": "intervalMonths",
  "interval-too-long": "intervalMonths",
  "start-date-required": "startDate",
  "start-date-out-of-range": "startDate",
  "technology-without-machine-category": "technology",
  "technology-does-not-fit-machine-category": "technology",
};

/**
 * The form „Wartungsaufgabe hinzufügen“ (ST-040) on shadcn's Field (G8, G9): native controls only – a number, a date,
 * two selects and a checkbox –, so it works without JavaScript. Which technologies fit which machine category is said
 * in the technology's label; the command rejects a combination that does not fit with its own reason. A rejection keeps
 * every value, names the reason above the submit button and marks the field that caused it.
 */
export function AddMaintenanceTaskForm({ version, machineCategories, technologies }: Choices & { version: number }) {
  const [state, action, pending] = useActionState(addMaintenanceTaskAction, null);
  const rejectionId = useId();
  const kept = keptKey(state);
  const invalid = state ? fieldOf[state.error] : undefined;
  // A technology that does not fit its machine category: either of the two may be the one to change (G8).
  const categoryInvalid = state?.error === "technology-does-not-fit-machine-category";
  const marked = (field: AddMaintenanceTaskField, hint?: string) => {
    const describedBy = [hint, invalid === field ? rejectionId : undefined].filter(Boolean).join(" ");
    return { "aria-invalid": invalid === field || undefined, "aria-describedby": describedBy || undefined };
  };

  return (
    <form action={action} className="flex flex-col gap-5">
      <VersionField version={version} />
      <Field data-invalid={invalid === "name"}>
        <FieldLabel htmlFor="name">{texts.name}</FieldLabel>
        <Input
          id="name"
          name="name"
          defaultValue={state?.values.name}
          key={`name-${kept}`}
          required
          {...marked("name")}
        />
      </Field>
      <Field data-invalid={invalid === "instruction"}>
        <FieldLabel htmlFor="instruction">{texts.instruction}</FieldLabel>
        <Textarea
          id="instruction"
          name="instruction"
          defaultValue={state?.values.instruction}
          key={`instruction-${kept}`}
          required
          {...marked("instruction")}
        />
      </Field>
      <Field data-invalid={invalid === "intervalMonths"}>
        <FieldLabel htmlFor="intervalMonths">{texts.intervalMonths}</FieldLabel>
        <Input
          id="intervalMonths"
          name="intervalMonths"
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          defaultValue={state?.values.intervalMonths}
          key={`intervalMonths-${kept}`}
          required
          {...marked("intervalMonths")}
        />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="suitableForHelpers"
          defaultChecked={state ? state.values.suitableForHelpers !== "" : false}
          key={`suitableForHelpers-${kept}`}
          className="size-4"
        />
        {terms["Suitable for helpers"]}
      </label>
      <Field data-invalid={categoryInvalid}>
        <FieldLabel htmlFor="machineCategory">{texts.machineCategory}</FieldLabel>
        <NativeSelect
          id="machineCategory"
          name="machineCategory"
          defaultValue={state?.values.machineCategory ?? ""}
          key={`machineCategory-${kept}`}
          aria-invalid={categoryInvalid || undefined}
          aria-describedby={categoryInvalid ? rejectionId : undefined}
        >
          <option value="">{texts.noRestriction}</option>
          {machineCategories.map((category) => (
            <option key={category.value} value={category.value}>
              {category.label}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field data-invalid={invalid === "technology"}>
        <FieldLabel htmlFor="technology">{texts.technology}</FieldLabel>
        <NativeSelect
          id="technology"
          name="technology"
          defaultValue={state?.values.technology ?? ""}
          key={`technology-${kept}`}
          {...marked("technology")}
        >
          <option value="">{texts.noRestriction}</option>
          {technologies.map((technology) => (
            <option key={technology.value} value={technology.value}>
              {technology.label}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field data-invalid={invalid === "startDate"}>
        <FieldLabel htmlFor="startDate">{texts.startDate}</FieldLabel>
        <Input
          id="startDate"
          name="startDate"
          type="date"
          defaultValue={state?.values.startDate}
          key={`startDate-${kept}`}
          required
          {...marked("startDate", "startDate-hint")}
        />
        <FieldDescription id="startDate-hint">{texts.startDateHint}</FieldDescription>
      </Field>
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
