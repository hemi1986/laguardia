import { aggregateCommand } from "@/platform/command";
import { correctMachineModel } from "./correct-machine-model";
import { machineModelActors } from "./create-machine-model";
import { collectionEvents } from "./events";
import { machineModels } from "./machine-models";

/**
 * CMD-CorrectMachineModel through the command layer: a change of AGG-MachineModel at the version the technician saw,
 * emits EVT-MachineModelCorrected. Technicians only – the command layer rejects everyone else with `not-authorized`.
 */
export const correctMachineModelCommand = aggregateCommand({
  id: "CMD-CorrectMachineModel",
  allowedActors: machineModelActors,
  store: machineModels,
  target: (input) => ({ id: input.machineModelId, version: input.version }),
  decide: correctMachineModel,
  journal: collectionEvents.journal,
  result: (model) => ({ machineModelId: model.id, title: model.title }),
});
