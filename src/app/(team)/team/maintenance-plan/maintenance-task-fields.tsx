import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ChangeMaintenancePlanError } from "@/modules/maintenance";
import { teamMessages } from "@/platform/messages";
import type { MaintenanceTaskField } from "./maintenance-task-input";

const { maintenancePlan: texts, terms } = teamMessages;

/** The field that caused a rejection – marked at the form (G8). */
export const fieldOf: Partial<Record<string, "name" | MaintenanceTaskField>> = {
  "name-required": "name",
  "instruction-required": "instruction",
  "interval-not-positive": "intervalMonths",
  "interval-too-long": "intervalMonths",
} satisfies Partial<Record<ChangeMaintenancePlanError, "name" | MaintenanceTaskField>>;

/**
 * The details of a maintenance task on shadcn's Field (G8, G9), shared by adding and changing one (ST-040, ST-041):
 * native controls only – a textarea, a number and a checkbox –, so the form works without JavaScript. There is no
 * restriction to a machine category or technology and no start date any more (ST-094). Each field shows `values` – what was
 * typed, or the task as it is – and is keyed on `kept`, so a rejection keeps it; the field that caused the rejection
 * `error` is marked and points at `rejectionId`.
 */
export function MaintenanceTaskFields({
  values,
  kept,
  error,
  rejectionId,
}: {
  /** What was typed (a ticked checkbox is any text but "") – or the task as it is, its mark a boolean. */
  values: { readonly [F in Exclude<MaintenanceTaskField, "suitableForHelpers">]?: string } & {
    suitableForHelpers?: string | boolean;
  };
  kept: string;
  error: string | undefined;
  rejectionId: string;
}) {
  const invalid = error ? fieldOf[error] : undefined;
  const marked = (field: MaintenanceTaskField) => ({
    "aria-invalid": invalid === field || undefined,
    "aria-describedby": invalid === field ? rejectionId : undefined,
  });

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
    </>
  );
}
