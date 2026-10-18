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

/** Who may create or correct a machine model – the allowed actors of CMD-CreateMachineModel and CMD-CorrectMachineModel. */
export const machineModelActors = ["technician"] as const;

type CreatingPerson = ActorOf<(typeof machineModelActors)[number]>;

/** The details of a machine model, as every machine of that model shows them (data model). */
export type MachineModel = {
  id: string;
  title: string;
  manufacturer: string;
  year?: number;
  machineCategory: MachineCategory;
  technology?: Technology;
};

/**
 * One entry of a machine model's category history (ST-036): the machine category and technology from `holdsFrom` on.
 * The first entry is the creation; a correction that changes either appends one.
 */
export type CategoryChange = {
  /** From the command's ID generator – the history is saved by inserting the entries not stored yet (Q13). */
  id: string;
  machineCategory: MachineCategory;
  technology?: Technology;
  holdsFrom: Date;
};

/** AGG-MachineModel – current state (docs/architecture/data-model.md): its details and its category history. */
export type MachineModelState = MachineModel & { categoryHistory: CategoryChange[] };

export type MachineModelCreated = {
  type: "EVT-MachineModelCreated";
  machineModelId: string;
  title: string;
  manufacturer: string;
  year?: number;
  machineCategory: MachineCategory;
  technology?: Technology;
};

/**
 * What the acting person gave. The machine category and the technology are "no value given" when the form had
 * none (ST-073, Q19); the year arrives as it was typed, because a year that is not a four-digit year is rejected
 * rather than dropped and only the decision may say so.
 */
export type CreateMachineModelInput = {
  title: string;
  manufacturer: string;
  year?: string;
  machineCategory: MachineCategory | undefined;
  technology?: Technology;
};

export type CreateMachineModelError =
  | "title-required"
  | "manufacturer-required"
  | "year-must-be-four-digits"
  | "machine-category-required"
  | "technology-does-not-fit-machine-category";

/**
 * The invariants of AGG-MachineModel on what a technician gave – for creating and correcting alike (ST-036): title,
 * manufacturer and machine category required, a given year four digits, the technology fitting the machine category.
 */
export function machineModelDetails(
  input: CreateMachineModelInput,
): { ok: true; details: Omit<MachineModel, "id"> } | { ok: false; error: CreateMachineModelError } {
  const title = input.title.trim();
  if (!title) return { ok: false, error: "title-required" };
  const manufacturer = input.manufacturer.trim();
  if (!manufacturer) return { ok: false, error: "manufacturer-required" };
  // The year is optional, but one that is given must be a four-digit calendar year (user, 2026-10-01) – no
  // plausibility range: 1067 is allowed, "ca. 1997" is not, and the museum is told instead of losing the input.
  const typedYear = input.year?.trim() ?? "";
  if (typedYear && !/^\d{4}$/.test(typedYear)) return { ok: false, error: "year-must-be-four-digits" };
  const { machineCategory } = input;
  if (!machineCategory) return { ok: false, error: "machine-category-required" };
  const { technology } = input;
  if (technology && !technologiesOf(machineCategory).includes(technology)) {
    return { ok: false, error: "technology-does-not-fit-machine-category" };
  }
  return {
    ok: true,
    details: { title, manufacturer, year: typedYear ? Number(typedYear) : undefined, machineCategory, technology },
  };
}

export function createMachineModel(
  _nothingYet: undefined,
  input: CreateMachineModelInput,
  { clock, newId }: DecisionContext<CreatingPerson>,
): Decision<MachineModelState, MachineModelCreated, CreateMachineModelError> {
  const checked = machineModelDetails(input);
  if (!checked.ok) return checked;
  const { details } = checked;
  const model: MachineModelState = {
    id: newId(),
    ...details,
    categoryHistory: [
      { id: newId(), machineCategory: details.machineCategory, technology: details.technology, holdsFrom: clock.now() },
    ],
  };
  return {
    ok: true,
    state: model,
    events: [{ type: "EVT-MachineModelCreated", machineModelId: model.id, ...details }],
  };
}
