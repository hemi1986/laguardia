import { machineCategories, technologies } from "@/modules/collection";
import type { MaintenanceTaskChanges } from "@/modules/maintenance";
import type { FormFields } from "@/app/_actions/form-action";
import { isCalendarDate } from "@/platform/time";

/** The fields of a maintenance task that adding and changing share – everything but its name (ST-040, ST-041). */
export const maintenanceTaskFields = [
  "instruction",
  "intervalMonths",
  "suitableForHelpers",
  "machineCategory",
  "technology",
  "startDate",
] as const;

export type MaintenanceTaskField = (typeof maintenanceTaskFields)[number];

/**
 * Reads a maintenance task's details from a form (ST-040, ST-041, Q19): no validation, no default. An interval that is
 * not a whole number, a start date that is not a calendar date and an unknown machine category or technology are
 * "nothing given" – the command says what is missing; no machine category is no restriction. The checkbox is sent only
 * when ticked.
 */
export function maintenanceTaskChangesOf(fields: FormFields<MaintenanceTaskField>): MaintenanceTaskChanges {
  const interval = fields.intervalMonths?.trim() ?? "";
  const startDate = fields.startDate?.trim() ?? "";
  return {
    instruction: fields.instruction ?? "",
    intervalMonths: /^-?\d+$/.test(interval) ? Number(interval) : undefined,
    suitableForHelpers: fields.suitableForHelpers !== undefined,
    machineCategory: machineCategories.find((category) => category === fields.machineCategory),
    technology: technologies.find((technology) => technology === fields.technology),
    startDate: isCalendarDate(startDate) ? startDate : undefined,
  };
}
