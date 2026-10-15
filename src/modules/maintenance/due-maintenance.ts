import type { MachineCategory, MachineForMaintenance, Technology } from "@/modules/collection";
import type { Clock } from "@/platform/clock";
import type { Database } from "@/platform/command";
import { addDays, calendarDate, graceDays, maintenanceDates, today, type CalendarDate } from "@/platform/time";
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
  /** Its restriction – which machines it applies to (HS-10). */
  machineCategory: MachineCategory | undefined;
  technology: Technology | undefined;
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
 * record *done* (ST-044) – a record *partially done* restarts nothing. A machine *Not on display* is never due; after
 * its return a task that was already due counts from the return (ST-056).
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
      // A machine Not on display is never due; maintenance recorded there still counts (HS-13, ST-056).
      if (machine.machineStatus === "not-on-display" || !maintenanceTaskAppliesTo(task, machine)) return [];
      // The latest record *done* – but never before the start date or the registration, which count as last done too
      // (user, 2026-10-15, ST-044).
      const lastDone = latest(
        task.startDate,
        calendarDate(machine.registeredAt),
        recorded.get(lastDoneKey(task.id, machine.id)),
      );
      const { dueDate, overdueFrom } = dueAfterReturn(
        maintenanceDates(lastDone, task.intervalMonths),
        machine.returnedToDisplayAt && calendarDate(machine.returnedToDisplayAt),
        task.intervalMonths,
      );
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
        machineCategory: task.machineCategory,
        technology: task.technology,
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

/**
 * Back on display (HS-20, as revised in D5; ST-056): a task already due when the machine returned counts as due since
 * the return, and overdue 25 % of the interval's actual days after it; any other task keeps its normal dates.
 */
function dueAfterReturn(
  dates: { dueDate: CalendarDate; overdueFrom: CalendarDate },
  returnedOn: CalendarDate | undefined,
  intervalMonths: number,
): { dueDate: CalendarDate; overdueFrom: CalendarDate } {
  if (!returnedOn || dates.dueDate >= returnedOn) return dates;
  return { dueDate: returnedOn, overdueFrom: addDays(returnedOn, graceDays(returnedOn, intervalMonths)) };
}
