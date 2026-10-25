import { visitorMachine } from "@/modules/collection";
import type { Database } from "@/platform/command";

/**
 * What the report form page shows of the machine (ST-013): its title – no ID, nothing internal. None for a retired
 * machine: reporting is not offered for it (ST-055).
 */
export async function loadReportForm(db: Database, museumNumber: string) {
  const machine = await visitorMachine(db, museumNumber);
  return machine && !machine.retired ? { machineModelTitle: machine.machineModelTitle } : undefined;
}
