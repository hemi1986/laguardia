import { aggregateCommand } from "@/platform/command";
import { createMachineModel, machineModelActors } from "./create-machine-model";
import { machineModels } from "./machine-models";
import { collectionEvents } from "./events";

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
  journal: collectionEvents.journal,
  result: (model) => ({ machineModelId: model.id }),
});
