import { machinesForMaintenance } from "@/modules/collection";
import type { Clock } from "@/platform/clock";
import type { Database, Role } from "@/platform/command";
import { addDays, today, type CalendarDate } from "@/platform/time";
import { byLocation, dueOn } from "./due-maintenance";
import { activeMaintenanceTasks } from "./maintenance-plans";
import { maintenanceTaskAppliesTo } from "./machines-of-maintenance-task";
import { LONGEST_BACK_DATING_DAYS, recordRefusal, type RecordMaintenanceError } from "./record-maintenance";

/** A machine the selection offers – what the team member recognises it by. */
export type MachineToChoose = { machineId: string; museumNumber: string; machineModelTitle: string; location: string };

/**
 * A maintenance task as the selection page „Für mehrere Geräte erfassen“ needs it (ST-045, decision D8): the machines
 * it is due on – preselected, in the due maintenance list's order – and every other machine it applies to, by location;
 * only those on which CMD-RecordMaintenance would accept the team member who asks (G11). `whyNot` is the command's
 * reason when it would accept them on none of them, and the dates are the ones it accepts (D6).
 */
export type MaintenanceForSeveral = {
  maintenanceTask: { id: string; name: string; instruction: string };
  due: MachineToChoose[];
  others: MachineToChoose[];
  whyNot: RecordMaintenanceError | undefined;
  today: CalendarDate;
  earliest: CalendarDate;
};

/**
 * On Collection's machines as it publishes them for maintenance (context map), read here in one call. Undefined for a
 * maintenance task not in the plan – removed ones included.
 */
export async function maintenanceForSeveral(
  db: Database,
  clock: Clock,
  maintenanceTaskId: string,
  teamMember: { role: Role },
): Promise<MaintenanceForSeveral | undefined> {
  const [tasks, machines] = await Promise.all([activeMaintenanceTasks(db), machinesForMaintenance(db)]);
  const task = tasks.find((candidate) => candidate.id === maintenanceTaskId);
  if (!task) return undefined;
  const dueHere = (await dueOn(db, clock, machines, teamMember)).find((due) => due.id === task.id);
  const applicable = machines.filter((machine) => maintenanceTaskAppliesTo(task, machine.id));
  const refusals = applicable.map((machine) => recordRefusal(task, machine, teamMember));
  const offered = applicable.filter((_machine, index) => refusals[index] === undefined);
  const dueIds = new Set(dueHere?.machines.map((machine) => machine.machineId));
  const now = today(clock);
  return {
    maintenanceTask: { id: task.id, name: task.name, instruction: task.instruction },
    due: (dueHere?.machines ?? []).filter((machine) => machine.recordOffered).map(toChoose),
    others: offered
      .filter((machine) => !dueIds.has(machine.id))
      .map((machine) => toChoose({ ...machine, machineId: machine.id }))
      .sort(byLocation),
    whyNot: offered.length === 0 ? refusals.find((refusal) => refusal !== undefined) : undefined,
    today: now,
    earliest: addDays(now, -LONGEST_BACK_DATING_DAYS),
  };
}

function toChoose({ machineId, museumNumber, machineModelTitle, location }: MachineToChoose): MachineToChoose {
  return { machineId, museumNumber, machineModelTitle, location };
}
