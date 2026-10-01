import { aggregateCommand } from "@/platform/command";
import { createMachineModel, machineModelActors } from "./create-machine-model";
import { machineModels } from "./machine-models";

/**
 * CMD-CreateMachineModel through the command layer: a creating command on AGG-MachineModel, emits
 * EVT-MachineModelCreated. Technicians only – the command layer rejects everyone else with `not-authorized`.
 */
export const createMachineModelCommand = aggregateCommand({
  id: "CMD-CreateMachineModel",
  allowedActors: machineModelActors,
  store: machineModels,
  creates: true,
  decide: createMachineModel,
  journal: (event) => ({
    type: event.type,
    aggregate: { type: "AGG-MachineModel", id: event.machineModelId },
    machineId: null, // a machine model belongs to no machine; its machines refer to it (ST-007)
    data: { machineCategory: event.machineCategory, technology: event.technology ?? null },
  }),
  result: (model) => ({ machineModelId: model.id }),
});
