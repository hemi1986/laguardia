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
 * arrives as it was typed (the decision trims it); an unknown machine category or technology is "no value given",
 * so CMD-CreateMachineModel rejects it with its own reason (`machine-category-required`).
 *
 * The year has no rule in `events.yaml`, so anything that is not a four-digit year is "no value given" too and the
 * machine model is created without a year – the technician is not told. Whether that should be a rejection of its
 * own instead is an open question (`docs/stories/OPEN_QUESTIONS.md`, ST-006, 2026-09-30). Four digits is not a
 * domain rule but the bound that keeps a slip on the numeric keypad ("99999999999") out of the `integer` column:
 * PostgreSQL would raise 22003, which no command error maps, so it would reach the technician as a 500.
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
  return value && /^\d{4}$/.test(value.trim()) ? Number(value) : undefined;
}

function oneOf<Value extends MachineCategory | Technology>(
  known: readonly Value[],
  value: string | undefined,
): Value | undefined {
  return known.find((known) => known === value);
}
