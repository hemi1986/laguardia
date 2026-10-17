import { aggregateCommand } from "@/platform/command";
import { machines, registrationFacts } from "./machines";
import { registerMachine, registeringActors } from "./register-machine";
import { collectionEvents } from "./events";

/**
 * CMD-RegisterMachine through the command layer: a creating command on AGG-Machine, emits EVT-MachineRegistered.
 * Technicians only. Its facts – the museum numbers given out so far and whether the machine model exists – are read
 * under a lock in the same transaction (HS-17).
 */
export const registerMachineCommand = aggregateCommand({
  id: "CMD-RegisterMachine",
  allowedActors: registeringActors,
  store: machines,
  creates: true,
  facts: registrationFacts,
  decide: registerMachine,
  journal: collectionEvents.journal,
  result: (machine) => ({ machineId: machine.id, museumNumber: machine.museumNumber }),
});
