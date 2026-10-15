import { machineCategories, technologies } from "@/modules/collection";
import type { ChangeMaintenancePlanInput } from "@/modules/maintenance";
import type { FormFields } from "@/app/_actions/form-action";
import { versionSeen } from "@/app/_actions/version";

/** The form's own fields – only these are read and echoed after a rejection (ST-073). */
export const addMaintenanceTaskFields = [
  "version",
  "name",
  "instruction",
  "intervalMonths",
  "suitableForHelpers",
  "machineCategory",
  "technology",
  "startDate",
] as const;

export type AddMaintenanceTaskField = (typeof addMaintenanceTaskFields)[number];

/**
 * Reads the form „Wartungsaufgabe hinzufügen“ (ST-040, Q19): no validation, no default. An interval that is not a whole
 * number, a start date that is not a calendar date and an unknown machine category or technology are "nothing given"
 * – the command says what is missing; no machine category is no restriction. The checkbox is sent only when ticked.
 */
export function addMaintenanceTaskInput(fields: FormFields<AddMaintenanceTaskField>): ChangeMaintenancePlanInput {
  const interval = fields.intervalMonths?.trim() ?? "";
  const startDate = fields.startDate?.trim() ?? "";
  return {
    version: versionSeen(fields.version),
    change: "add",
    task: {
      name: fields.name ?? "",
      instruction: fields.instruction ?? "",
      intervalMonths: /^-?\d+$/.test(interval) ? Number(interval) : undefined,
      suitableForHelpers: fields.suitableForHelpers !== undefined,
      machineCategory: machineCategories.find((category) => category === fields.machineCategory),
      technology: technologies.find((technology) => technology === fields.technology),
      startDate: /^\d{4}-\d{2}-\d{2}$/.test(startDate) ? startDate : undefined,
    },
  };
}
