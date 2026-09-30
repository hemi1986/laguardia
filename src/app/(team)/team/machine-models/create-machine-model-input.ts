import {
  machineCategories,
  technologies,
  type CreateMachineModelInput,
  type MachineCategory,
  type Technology,
} from "@/modules/collection";
import type { FormFields } from "@/app/_actions/form-action";

/** The form's own fields – only these are read and echoed after a rejection (ST-073). */
export const createMachineModelFields = ["title", "manufacturer", "year", "machineCategory", "technology"] as const;

type Fields = FormFields<(typeof createMachineModelFields)[number]>;

/**
 * Reads and converts the fields of the machine model form (ST-073, Q19): no validation, no default. Free text
 * arrives as it was typed (the decision trims it); a year that is no number and an unknown machine category or
 * technology are "no value given", so CMD-CreateMachineModel rejects them with its own reason.
 */
export function createMachineModelInput(fields: Fields): CreateMachineModelInput {
  return {
    title: fields.title ?? "",
    manufacturer: fields.manufacturer ?? "",
    year: yearOf(fields.year),
    machineCategory: oneOf(machineCategories, fields.machineCategory),
    technology: oneOf(technologies, fields.technology),
  };
}

function yearOf(value: string | undefined): number | undefined {
  return value && /^\d+$/.test(value.trim()) ? Number(value) : undefined;
}

function oneOf<Value extends MachineCategory | Technology>(
  known: readonly Value[],
  value: string | undefined,
): Value | undefined {
  return known.find((known) => known === value);
}
