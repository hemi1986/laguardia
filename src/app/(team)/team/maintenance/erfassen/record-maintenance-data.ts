import { machineForMaintenance, machineIdOf, machineLabels } from "@/modules/collection";
import {
  LONGEST_BACK_DATING_DAYS,
  maintenancePlan,
  recordRefusal,
  type RecordMaintenanceError,
} from "@/modules/maintenance";
import type { Clock } from "@/platform/clock";
import type { Database } from "@/platform/command";
import { addDays, today, type CalendarDate } from "@/platform/time";
import type { Viewer } from "../../claimant";

/** What the form page „Wartung erfassen“ shows (ST-044): the maintenance task, the machine and the dates allowed. */
export type MaintenanceForRecording = {
  maintenanceTask: { id: string; name: string; instruction: string };
  machine: { id: string; museumNumber: string; machineModelTitle: string; location: string };
  /** Why CMD-RecordMaintenance would refuse this team member here – none when it would not (G11). */
  whyNot: RecordMaintenanceError | undefined;
  /** The date preselected – today – and the earliest one allowed (D6). */
  today: CalendarDate;
  earliest: CalendarDate;
};

/**
 * Maintenance's maintenance task and its rule, Collection's machine – the page composes (ST-009). Undefined when there
 * is no such maintenance task in the plan or no such machine that is not retired.
 */
export async function loadMaintenanceForRecording(
  db: Database,
  clock: Clock,
  maintenanceTaskId: string,
  museumNumber: string,
  viewer: Viewer,
): Promise<MaintenanceForRecording | undefined> {
  const [plan, machineId] = await Promise.all([maintenancePlan(db), machineIdOf(db, museumNumber)]);
  const task = plan.maintenanceTasks.find((candidate) => candidate.id === maintenanceTaskId);
  if (!task || !machineId) return undefined;
  const [facts, labels] = await Promise.all([machineForMaintenance(db, machineId), machineLabels(db, [machineId])]);
  const label = labels.get(machineId);
  if (!facts || !label) return undefined;
  const now = today(clock);
  return {
    maintenanceTask: { id: task.id, name: task.name, instruction: task.instruction },
    machine: {
      id: machineId,
      museumNumber: label.museumNumber,
      machineModelTitle: label.machineModelTitle,
      location: facts.location,
    },
    whyNot: recordRefusal(task, facts, { role: viewer.role }),
    today: now,
    earliest: addDays(now, -LONGEST_BACK_DATING_DAYS),
  };
}
