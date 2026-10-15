import type { MachineForMaintenance } from "@/modules/collection";
import type { Clock } from "@/platform/clock";
import type { Database } from "@/platform/command";
import { calendarDate, maintenanceDates, today, type CalendarDate } from "@/platform/time";
import { activeMaintenanceTasks, maintenanceTaskAppliesTo } from "./maintenance-plans";
import { lastDoneByRecord, lastDoneKey } from "./maintenance-records";

/** A machine on which a maintenance task is due (EVT-MaintenanceTaskDue, computed on read – ADR 0002). */
export type DueMachine = {
  machineId: string;
  museumNumber: string;
  machineModelTitle: string;
  location: string;
  lastDone: CalendarDate;
  dueSince: CalendarDate;
  /** Due for more than 25 % of the interval (EVT-MaintenanceTaskOverdue, ST-003). */
  overdue: boolean;
};

/** A maintenance task that is due on at least one machine, with those machines – sorted by location. */
export type DueMaintenanceTask = {
  id: string;
  name: string;
  instruction: string;
  suitableForHelpers: boolean;
  machines: DueMachine[];
  /** How many of its machines it is overdue on. */
  overdueCount: number;
};

/**
 * RM-DueMaintenance (ST-043) – on Collection's machines as it publishes them for maintenance (context map), which the
 * page passes in: every maintenance task of the plan that is due today on a machine it applies to, with
 * those machines – computed when the page loads (ADR 0002). The tasks with the most overdue machines first, then the
 * most due machines, then by name (user, 2026-10-15); within a task its machines by location.
 *
 * Last done is the latest of the task's start date, the machine's registration date (HS-20) and its latest maintenance
 * record *done* (ST-044) – a record *partially done* restarts nothing. Machines *Not on display* follow with ST-056.
 */
export async function dueMaintenance(
  db: Database,
  clock: Clock,
  machines: readonly MachineForMaintenance[],
): Promise<DueMaintenanceTask[]> {
  const now = today(clock);
  const [tasks, recorded] = await Promise.all([
    activeMaintenanceTasks(db),
    lastDoneByRecord(
      db,
      machines.map((machine) => machine.id),
    ),
  ]);
  const due = tasks.flatMap((task) => {
    const dueMachines = machines.flatMap((machine) => {
      if (!maintenanceTaskAppliesTo(task, machine)) return [];
      // The latest record *done* – but never before the start date or the registration, which count as last done too
      // (user, 2026-10-15, ST-044).
      const lastDone = latest(
        task.startDate,
        calendarDate(machine.registeredAt),
        recorded.get(lastDoneKey(task.id, machine.id)),
      );
      const { dueDate, overdueFrom } = maintenanceDates(lastDone, task.intervalMonths);
      if (now < dueDate) return [];
      return [
        {
          machineId: machine.id,
          museumNumber: machine.museumNumber,
          machineModelTitle: machine.machineModelTitle,
          location: machine.location,
          lastDone,
          dueSince: dueDate,
          overdue: now >= overdueFrom,
        },
      ];
    });
    if (dueMachines.length === 0) return [];
    return [
      {
        id: task.id,
        name: task.name,
        instruction: task.instruction,
        suitableForHelpers: task.suitableForHelpers,
        machines: dueMachines.sort(byLocation),
        overdueCount: dueMachines.filter((machine) => machine.overdue).length,
      },
    ];
  });
  return due.sort(
    (a, b) =>
      b.overdueCount - a.overdueCount || b.machines.length - a.machines.length || a.name.localeCompare(b.name, "de"),
  );
}

/** By location as people read it – "row 2" before "row 10" –, then by museum number. */
function byLocation(a: DueMachine, b: DueMachine): number {
  return (
    a.location.localeCompare(b.location, "de", { numeric: true }) ||
    a.museumNumber.localeCompare(b.museumNumber, "de", { numeric: true })
  );
}

/** The latest of the given calendar dates – they compare as text. */
function latest(...dates: (CalendarDate | undefined)[]): CalendarDate {
  return dates.filter((date): date is CalendarDate => date !== undefined).reduce((a, b) => (b > a ? b : a));
}
