import type { ActorOf, Decision, DecisionContext } from "@/platform/command";

/**
 * CMD-CreateMachineModel (AGG-MachineModel): a technician creates a machine model all machines of that model
 * share. The pure decision of a creating command – the command layer saves the new machine model at version 0.
 * Corrections follow with ST-036 (EVT-MachineModelCorrected).
 */

/** The kind of machine (docs/architecture/data-model.md, HS-10) – lowercase kebab-case, like every enumeration. */
export const machineCategories = ["pinball", "arcade", "other"] as const;
export type MachineCategory = (typeof machineCategories)[number];

/** The technical generation within a machine category; which ones fit which category is `technologiesOf`. */
export const technologies = ["em", "solid-state", "dmd", "lcd", "crt"] as const;
export type Technology = (typeof technologies)[number];

/** The invariant of AGG-MachineModel: the technology fits the machine category – Other has none (HS-10). */
const technologiesPerCategory = {
  pinball: ["em", "solid-state", "dmd", "lcd"],
  arcade: ["crt", "lcd"],
  other: [],
} as const satisfies Record<MachineCategory, readonly Technology[]>;

/** The technologies a machine category offers, in the order the form shows them. */
export function technologiesOf(machineCategory: MachineCategory): readonly Technology[] {
  return technologiesPerCategory[machineCategory];
}

/** Who may create a machine model – the allowed actors of CMD-CreateMachineModel. */
export const machineModelActors = ["technician"] as const;

type CreatingPerson = ActorOf<(typeof machineModelActors)[number]>;

/** AGG-MachineModel – current state (docs/architecture/data-model.md). */
export type MachineModel = {
  id: string;
  title: string;
  manufacturer: string;
  year?: number;
  machineCategory: MachineCategory;
  technology?: Technology;
};

export type MachineModelCreated = {
  type: "EVT-MachineModelCreated";
  machineModelId: string;
  title: string;
  manufacturer: string;
  year?: number;
  machineCategory: MachineCategory;
  technology?: Technology;
};

/** The machine category and the technology are "no value given" when the form had none (ST-073, Q19). */
export type CreateMachineModelInput = {
  title: string;
  manufacturer: string;
  year?: number;
  machineCategory: MachineCategory | undefined;
  technology?: Technology;
};

export type CreateMachineModelError =
  | "title-required"
  | "manufacturer-required"
  | "machine-category-required"
  | "technology-does-not-fit-machine-category";

export function createMachineModel(
  _nothingYet: undefined,
  input: CreateMachineModelInput,
  { newId }: DecisionContext<CreatingPerson>,
): Decision<MachineModel, MachineModelCreated, CreateMachineModelError> {
  const title = input.title.trim();
  if (!title) return { ok: false, error: "title-required" };
  const manufacturer = input.manufacturer.trim();
  if (!manufacturer) return { ok: false, error: "manufacturer-required" };
  const { machineCategory } = input;
  if (!machineCategory) return { ok: false, error: "machine-category-required" };
  const { technology } = input;
  if (technology && !technologiesOf(machineCategory).includes(technology)) {
    return { ok: false, error: "technology-does-not-fit-machine-category" };
  }

  const model: MachineModel = {
    id: newId(),
    title,
    manufacturer,
    year: input.year,
    machineCategory,
    technology,
  };
  const { id: machineModelId, ...created } = model;
  return { ok: true, state: model, events: [{ type: "EVT-MachineModelCreated", machineModelId, ...created }] };
}
