import { aggregateCommand } from "@/platform/command";
import { changeMachineStatus, changingActors } from "./change-machine-status";
import { machines } from "./machines";

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
  journal: (event) => ({
    type: event.type,
    aggregate: { type: "AGG-Machine", id: event.machineId },
    machineId: event.machineId,
    // References and non-personal facts only: the reason is typed text and lives in the status history (ST-003).
    data: { previousStatus: event.previousStatus, newStatus: event.newStatus },
  }),
  result: (machine) => ({ museumNumber: machine.museumNumber, machineStatus: machine.machineStatus }),
});
