import { aggregateCommand } from "@/platform/command";
import { collectionEvents } from "./events";
import { machines, retirementLock } from "./machines";
import { retireMachine, retiringActors, type RetirementFacts } from "./retire-machine";

/**
 * CMD-RetireMachine through the command layer: a change of AGG-Machine at the version the technician saw, emits
 * EVT-MachineRetired. Its facts take the machine's retirement lock exclusively (ADR 0010), so a problem report or a
 * maintenance record in flight finishes first and one that starts meanwhile waits and then finds the machine retired.
 * Repair exports this command with its retirement policies added – the page uses that one.
 */
export const retireMachineCommand = aggregateCommand({
  id: "CMD-RetireMachine",
  allowedActors: retiringActors,
  store: machines,
  target: (input) => ({ id: input.machineId, version: input.version }),
  facts: async (tx, input): Promise<RetirementFacts> => {
    await retirementLock(tx, input.machineId, "exclusive");
    return { lock: "held" };
  },
  decide: retireMachine,
  journal: collectionEvents.journal,
  result: (machine) => ({ machineId: machine.id, museumNumber: machine.museumNumber }),
});
