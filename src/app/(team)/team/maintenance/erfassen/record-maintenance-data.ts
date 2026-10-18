import { machineForMaintenance, machineIdOf, machineLabels } from "@/modules/collection";
import { maintenanceForRecording, type MaintenanceForRecording } from "@/modules/maintenance";
import type { Clock } from "@/platform/clock";
import type { Database } from "@/platform/command";
import type { Viewer } from "../../claimant";

/** What the form page „Wartung erfassen“ shows (ST-044): the maintenance task, the machine and the dates allowed. */
export type RecordMaintenancePageData = MaintenanceForRecording & {
  machine: { id: string; museumNumber: string; machineModelTitle: string; location: string };
};

/**
 * Collection's machine, and Maintenance's answer for it – the task, whether the viewer may record it there, the dates –
 * the page composes (ST-009). Undefined when there is no such maintenance task in the plan or no such machine.
 */
export async function loadMaintenanceForRecording(
  db: Database,
  clock: Clock,
  maintenanceTaskId: string,
  museumNumber: string,
  viewer: Viewer,
): Promise<RecordMaintenancePageData | undefined> {
  const machineId = await machineIdOf(db, museumNumber);
  if (!machineId) return undefined;
  const [facts, labels] = await Promise.all([machineForMaintenance(db, machineId), machineLabels(db, [machineId])]);
  const label = labels.get(machineId);
  if (!facts || !label) return undefined;
  const recording = await maintenanceForRecording(db, clock, maintenanceTaskId, facts, viewer);
  return (
    recording && {
      ...recording,
      machine: {
        id: machineId,
        museumNumber: label.museumNumber,
        machineModelTitle: label.machineModelTitle,
        location: facts.location,
      },
    }
  );
}
