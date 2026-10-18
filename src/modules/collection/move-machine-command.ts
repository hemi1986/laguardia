import { aggregateCommand } from "@/platform/command";
import { collectionEvents } from "./events";
import { machines } from "./machines";
import { moveMachine, movingActors } from "./move-machine";

/**
 * CMD-MoveMachine through the command layer: a change of AGG-Machine at the version the acting person saw, emits
 * EVT-MachineMoved.
 */
export const moveMachineCommand = aggregateCommand({
  id: "CMD-MoveMachine",
  allowedActors: movingActors,
  store: machines,
  target: (input) => ({ id: input.machineId, version: input.version }),
  decide: moveMachine,
  journal: collectionEvents.journal,
  result: (machine) => ({ museumNumber: machine.museumNumber, location: machine.location }),
});
