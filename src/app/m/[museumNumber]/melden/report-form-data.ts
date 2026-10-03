import { visitorMachine } from "@/modules/collection";
import type { Database } from "@/platform/command";

/** What the report form page shows of the machine (ST-013): its title – no ID, nothing internal. */
export async function loadReportForm(db: Database, museumNumber: string) {
  const machine = await visitorMachine(db, museumNumber);
  return machine && { machineModelTitle: machine.machineModelTitle };
}
