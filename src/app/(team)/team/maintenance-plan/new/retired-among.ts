import { machineForMaintenance, machineLabels } from "@/modules/collection";
import { isId, type Database } from "@/platform/command";

/**
 * The museum numbers of the machines among the given ones that are retired now, in the order given – what the rejection
 * of a step names when a machine was retired meanwhile (ST-094). A page runs no command: no retirement lock (ADR 0010).
 */
export async function retiredAmong(db: Database, machineIds: readonly string[]): Promise<string[]> {
  // A forged step may name what is no ID at all – it is no retired machine, and the database would refuse to compare it.
  const unique = [...new Set(machineIds.filter(isId))];
  const [labels, machines] = await Promise.all([
    machineLabels(db, unique),
    Promise.all(unique.map((machineId) => machineForMaintenance(db, machineId, { inCommand: false }))),
  ]);
  return unique.flatMap((machineId, index) => {
    const museumNumber = labels.get(machineId)?.museumNumber;
    return machines[index]?.retired && museumNumber ? [museumNumber] : [];
  });
}
