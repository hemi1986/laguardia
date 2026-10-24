import type { Database } from "@/platform/command";
import { addressAfterRecording } from "./address-after-recording";
import type { RecordMaintenanceReturn } from "./record-maintenance-address";
import { recordMaintenanceFields, recordMaintenanceInput } from "./record-maintenance-input";

/**
 * The form „Wartung erfassen“ for the Server Action runner (ST-044, ST-047): its fields, its input, and – after
 * recording – the address back where it was opened from, which `land` goes to (the action redirects; a test notes it).
 */
export function recordMaintenanceDefinition(
  db: Database,
  back: RecordMaintenanceReturn,
  land: (address: string) => Promise<void>,
) {
  return {
    fields: recordMaintenanceFields,
    input: recordMaintenanceInput,
    onSuccess: async (result: { maintenanceRecordId: string; maintenanceTaskId: string; machineId: string }) =>
      land(await addressAfterRecording(db, back, result)),
  };
}
