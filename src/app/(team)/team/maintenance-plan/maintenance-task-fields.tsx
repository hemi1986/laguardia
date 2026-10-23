import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { ChangeMaintenancePlanError } from "@/modules/maintenance";
import { teamMessages } from "@/platform/messages";
import type { MaintenanceTaskField } from "./maintenance-task-input";

const { maintenancePlan: texts, terms } = teamMessages;

/** What the two selects offer – built by the page, so the client imports no module code. */
export type Choices = {
  machineCategories: { value: string; label: string }[];
  /** Every technology once, its label naming the machine categories it fits (as on the machine models' page). */
  technologies: { value: string; label: string }[];
};

/** The field that caused a rejection – marked at the form (G8). */
export const fieldOf: Partial<Record<string, "name" | MaintenanceTaskField>> = {
  "name-required": "name",
  "instruction-required": "instruction",
  "interval-not-positive": "intervalMonths",
  "interval-too-long": "intervalMonths",
  "start-date-required": "startDate",
  "start-date-out-of-range": "startDate",
  "technology-without-machine-category": "technology",
  "technology-does-not-fit-machine-category": "technology",
} satisfies Partial<Record<ChangeMaintenancePlanError, "name" | MaintenanceTaskField>>;

/**
 * The details of a maintenance task on shadcn's Field (G8, G9), shared by adding and changing one (ST-040, ST-041):
 * native controls only – a number, a date, two selects and a checkbox –, so the form works without JavaScript. Which
 * technologies fit which machine category is said in the technology's label. Each field shows `values` – what was
 * typed, or the task as it is – and is keyed on `kept`, so a rejection keeps it; the field that caused the rejection
 * `error` is marked and points at `rejectionId`.
 */
export function MaintenanceTaskFields({
  values,
  kept,
  error,
  rejectionId,
  machineCategories,
  technologies,
}: Choices & {
  /** What was typed (a ticked checkbox is any text but "") – or the task as it is, its mark a boolean. */
  values: { readonly [F in Exclude<MaintenanceTaskField, "suitableForHelpers">]?: string } & {
    suitableForHelpers?: string | boolean;
  };
  kept: string;
  error: string | undefined;
  rejectionId: string;
}) {
  const invalid = error ? fieldOf[error] : undefined;
  // A technology that does not fit its machine category: either of the two may be the one to change (G8).
  const categoryInvalid = error === "technology-does-not-fit-machine-category";
  const marked = (field: MaintenanceTaskField, hint?: string) => {
    const describedBy = [hint, invalid === field ? rejectionId : undefined].filter(Boolean).join(" ");
    return { "aria-invalid": invalid === field || undefined, "aria-describedby": describedBy || undefined };
  };

  return (
    <>
      <Field data-invalid={invalid === "instruction"}>
        <FieldLabel htmlFor="instruction">{texts.instruction}</FieldLabel>
        <Textarea
          id="instruction"
          name="instruction"
          defaultValue={values.instruction}
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
          defaultValue={values.intervalMonths}
          key={`intervalMonths-${kept}`}
          required
          {...marked("intervalMonths")}
        />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="suitableForHelpers"
          defaultChecked={!!values.suitableForHelpers}
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
          defaultValue={values.machineCategory ?? ""}
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
          defaultValue={values.technology ?? ""}
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
          defaultValue={values.startDate}
          key={`startDate-${kept}`}
          required
          {...marked("startDate", "startDate-hint")}
        />
        <FieldDescription id="startDate-hint">{texts.startDateHint}</FieldDescription>
      </Field>
    </>
  );
}
