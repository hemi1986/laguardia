import { aggregateCommand } from "@/platform/command";
import { correctMachineDetails, correctingActors } from "./correct-machine-details";
import { collectionEvents } from "./events";
import { correctionFacts, machines } from "./machines";

/**
 * CMD-CorrectMachineDetails through the command layer (ST-035): a change of AGG-Machine at the version the acting
 * person saw, emits EVT-MachineDetailsCorrected.
 */
export const correctMachineDetailsCommand = aggregateCommand({
  id: "CMD-CorrectMachineDetails",
  allowedActors: correctingActors,
  store: machines,
  target: (input) => ({ id: input.machineId, version: input.version }),
  facts: correctionFacts,
  decide: correctMachineDetails,
  journal: collectionEvents.journal,
  result: (machine, events) => ({
    machineId: machine.id,
    museumNumber: machine.museumNumber,
    previousMuseumNumber: events[0].previousMuseumNumber,
  }),
});
