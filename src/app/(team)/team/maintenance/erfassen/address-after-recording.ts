import { machineLabels } from "@/modules/collection";
import type { Database } from "@/platform/command";
import { recordedAddress, type RecordMaintenanceReturn } from "./record-maintenance-address";

/**
 * Where the form „Wartung erfassen“ leads after recording (ST-044, ST-047): back where it was opened from – the machine
 * record of the recorded machine, found by its ID on the server, or the due maintenance list.
 */
export async function addressAfterRecording(
  db: Database,
  back: RecordMaintenanceReturn,
  {
    maintenanceRecordId,
    maintenanceTaskId,
    machineId,
  }: { maintenanceRecordId: string; maintenanceTaskId: string; machineId: string },
): Promise<string> {
  const museumNumber =
    back === "machine" ? (await machineLabels(db, [machineId])).get(machineId)?.museumNumber : undefined;
  return recordedAddress({ maintenanceRecordId, maintenanceTaskId, museumNumber });
}
