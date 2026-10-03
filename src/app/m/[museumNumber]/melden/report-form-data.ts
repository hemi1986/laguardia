import { visitorMachine } from "@/modules/collection";
import type { Database } from "@/platform/command";

/** What the report form page needs: the machine's title to show and its ID for the problem report (ST-013). */
export async function loadReportForm(db: Database, museumNumber: string) {
  const machine = await visitorMachine(db, museumNumber);
  return machine && { machineId: machine.machineId, machineModelTitle: machine.machineModelTitle };
}
