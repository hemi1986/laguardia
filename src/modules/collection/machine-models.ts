import { asc, eq } from "drizzle-orm";
import { aggregateStore, history, isId, type Database } from "@/platform/command";
import type { CategoryChange, MachineModel, MachineModelState } from "./create-machine-model";
import { machine, machineModel, machineModelCategoryChange } from "./schema";

/** The category history of a machine model – append-only (Q13): only the entries not stored yet are inserted. */
export const categoryHistory = history({
  table: machineModelCategoryChange,
  owner: "machineModelId",
  toEntry: (row): CategoryChange => ({
    id: row.id,
    machineCategory: row.machineCategory,
    technology: row.technology ?? undefined,
    holdsFrom: row.holdsFrom,
  }),
  toRow: (change) => ({
    id: change.id,
    machineCategory: change.machineCategory,
    technology: change.technology ?? null,
    holdsFrom: change.holdsFrom,
  }),
});

/** How AGG-MachineModel is stored: one row per machine model, versioned (HS-16), with its category history (ST-036). */
export const machineModels = aggregateStore({
  type: "AGG-MachineModel",
  table: machineModel,
  histories: { categoryHistory },
  toState: (row, histories): MachineModelState => ({
    ...toMachineModel(row),
    categoryHistory: histories.categoryHistory,
  }),
  toRow: (model: MachineModelState) => ({
    id: model.id,
    title: model.title,
    manufacturer: model.manufacturer,
    year: model.year ?? null,
    machineCategory: model.machineCategory,
    technology: model.technology ?? null,
  }),
});

type MachineModelRow = typeof machineModel.$inferSelect;

function toMachineModel(row: Omit<MachineModelRow, "version">): MachineModel {
  return {
    id: row.id,
    title: row.title,
    manufacturer: row.manufacturer,
    year: row.year ?? undefined,
    machineCategory: row.machineCategory,
    technology: row.technology ?? undefined,
  };
}

/**
 * Read model: the machine models a technician can choose from – when registering a machine (ST-007) and on the
 * machine model page. Sorted by title, then manufacturer, the way both show them.
 */
export async function machineModelsToChooseFrom(db: Database): Promise<MachineModel[]> {
  const rows = await db
    .select({
      id: machineModel.id,
      title: machineModel.title,
      manufacturer: machineModel.manufacturer,
      year: machineModel.year,
      machineCategory: machineModel.machineCategory,
      technology: machineModel.technology,
    })
    .from(machineModel)
    .orderBy(asc(machineModel.title), asc(machineModel.manufacturer));
  return rows.map(toMachineModel);
}

/** One machine model as its page and its correction form show it (ST-036), with the version the technician saw. */
export type MachineModelForTeam = {
  model: MachineModel;
  version: number;
  /** All machines of this model, retired ones included – a correction applies to their machine records too. */
  machineCount: number;
};

/** The machine model by its ID, with its machine count (ST-036). Undefined for an unknown one or an address that is no ID. */
export async function machineModelForTeam(
  db: Database,
  machineModelId: string,
): Promise<MachineModelForTeam | undefined> {
  if (!isId(machineModelId)) return undefined;
  const [row] = await db
    .select({
      id: machineModel.id,
      title: machineModel.title,
      manufacturer: machineModel.manufacturer,
      year: machineModel.year,
      machineCategory: machineModel.machineCategory,
      technology: machineModel.technology,
      version: machineModel.version,
    })
    .from(machineModel)
    .where(eq(machineModel.id, machineModelId));
  if (!row) return undefined;
  const { version, ...model } = row;
  const machineCount = await db.$count(machine, eq(machine.machineModelId, machineModelId));
  return { model: toMachineModel(model), version, machineCount };
}
