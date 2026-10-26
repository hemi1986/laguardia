import type { MaintenanceTaskDetails } from "@/modules/maintenance";
import type { FormFields } from "@/app/_actions/form-action";

/** The fields of a maintenance task that adding and changing share – everything but its name (ST-040, ST-041). */
export const maintenanceTaskFields = ["instruction", "intervalMonths", "suitableForHelpers"] as const;

export type MaintenanceTaskField = (typeof maintenanceTaskFields)[number];

/**
 * Reads a maintenance task's details from a form (ST-040, ST-041, Q19): no validation, no default. An interval that is
 * not a whole number is "nothing given" – the command says what is missing. The checkbox is sent only when ticked.
 */
export function maintenanceTaskChangesOf(fields: FormFields<MaintenanceTaskField>): MaintenanceTaskDetails {
  const interval = fields.intervalMonths?.trim() ?? "";
  return {
    instruction: fields.instruction ?? "",
    intervalMonths: /^-?\d+$/.test(interval) ? Number(interval) : undefined,
    suitableForHelpers: fields.suitableForHelpers !== undefined,
  };
}
