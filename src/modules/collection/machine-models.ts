import { asc } from "drizzle-orm";
import { aggregateStore, type Database } from "@/platform/command";
import type { MachineModel } from "./create-machine-model";
import { machineModel } from "./schema";

/** How AGG-MachineModel is stored: one row per machine model, versioned (HS-16). */
export const machineModels = aggregateStore({
  type: "AGG-MachineModel",
  table: machineModel,
  toState: toMachineModel,
  toRow: (model: MachineModel) => ({
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
