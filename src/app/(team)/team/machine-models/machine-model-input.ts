import {
  machineCategories,
  technologies,
  type CreateMachineModelInput,
  type MachineCategory,
  type Technology,
} from "@/modules/collection";
import type { FormFields } from "@/app/_actions/form-action";

/** The machine model form's own fields – creating and correcting (ST-036) – only these are read and echoed (ST-073). */
export const machineModelFields = ["title", "manufacturer", "year", "machineCategory", "technology"] as const;

export type MachineModelField = (typeof machineModelFields)[number];

type Fields = FormFields<MachineModelField>;

/**
 * Reads and converts the fields of the machine model form, creating or correcting (ST-073, Q19): no validation, no default. Free text
 * arrives as it was typed (the decision trims it); an unknown machine category or technology is "no value given",
 * so CMD-CreateMachineModel rejects it with its own reason (`machine-category-required`). The year is passed on as
 * it was typed: that it must be a four-digit year is a domain rule and only the decision may say so
 * (`year-must-be-four-digits`, user 2026-10-01) – converting it here would drop "ca. 1997" without a word.
 */
export function machineModelInput(fields: Fields): CreateMachineModelInput {
  return {
    title: fields.title ?? "",
    manufacturer: fields.manufacturer ?? "",
    year: fields.year,
    machineCategory: oneOf(machineCategories, fields.machineCategory),
    technology: oneOf(technologies, fields.technology),
  };
}

function oneOf<Value extends MachineCategory | Technology>(
  known: readonly Value[],
  value: string | undefined,
): Value | undefined {
  return known.find((known) => known === value);
}
