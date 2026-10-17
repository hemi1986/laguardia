import { aggregateCommand } from "@/platform/command";
import { maintenanceFacts, maintenanceRecordStore } from "./maintenance-records";
import { recordMaintenance, recordingActors } from "./record-maintenance";
import { maintenanceEvents } from "./events";

/**
 * CMD-RecordMaintenance through the command layer: creates an AGG-MaintenanceRecord and emits EVT-MaintenanceRecorded
 * on its machine. Its facts – the maintenance task and the machine – are read in the command's transaction. The journal
 * names the maintenance task, the outcome and the day – never the note, which is typed text.
 */
export const recordMaintenanceCommand = aggregateCommand({
  id: "CMD-RecordMaintenance",
  allowedActors: recordingActors,
  store: maintenanceRecordStore,
  creates: true,
  facts: maintenanceFacts,
  decide: recordMaintenance,
  journal: maintenanceEvents.journal,
  result: (record) => ({ maintenanceRecordId: record.id, maintenanceTaskId: record.maintenanceTaskId }),
});
