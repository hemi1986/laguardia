import { aggregateCommand } from "@/platform/command";
import { changeMachineStatus, changingActors } from "./change-machine-status";
import { machines } from "./machines";
import { collectionEvents } from "./events";

/**
 * CMD-ChangeMachineStatus through the command layer: a change of AGG-Machine at the version the acting person saw,
 * emits EVT-MachineStatusChanged.
 */
export const changeMachineStatusCommand = aggregateCommand({
  id: "CMD-ChangeMachineStatus",
  allowedActors: changingActors,
  store: machines,
  target: (input) => ({ id: input.machineId, version: input.version }),
  decide: changeMachineStatus,
  journal: collectionEvents.journal,
  result: (machine) => ({ museumNumber: machine.museumNumber, machineStatus: machine.machineStatus }),
});
