import { machineForMaintenance } from "@/modules/collection";
import type { Database } from "@/platform/command";

/**
 * What a decision reads besides the plan when machines are chosen: the chosen machines as Collection knows them – one
 * entry per machine that exists (a machine La Guardia does not know is missing), read in the command's transaction
 * (context map).
 */
export type ChosenMachines = ReadonlyMap<string, { retired: boolean }>;

/**
 * Reads the machines as Collection knows them. Each read takes the machine's retirement lock shared (ADR 0010), so a
 * retirement in flight decides first – in the order of the machine IDs, so two commands cannot wait for each other.
 */
export async function readChosenMachines(tx: Database, machineIds: readonly string[]): Promise<ChosenMachines> {
  const found = new Map<string, { retired: boolean }>();
  for (const machineId of [...new Set(machineIds)].sort()) {
    const machine = await machineForMaintenance(tx, machineId);
    if (machine) found.set(machineId, { retired: machine.retired });
  }
  return found;
}
