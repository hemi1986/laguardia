import type { MachineCategory, Technology } from "@/modules/collection";
import type { Clock } from "@/platform/clock";
import type { Database } from "@/platform/command";
import { calendarDate, maintenanceDates, today, type CalendarDate } from "@/platform/time";
import { maintenancePlan, maintenanceTaskAppliesTo } from "./maintenance-plans";

/** A machine as maintenance needs it – what Collection publishes (context map); the page passes it in. */
export type MaintainedMachine = {
  id: string;
  museumNumber: string;
  machineModelTitle: string;
  location: string;
  machineCategory: MachineCategory;
  technology: Technology | undefined;
  registeredAt: Date;
};

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
  overdue: number;
};

/**
 * RM-DueMaintenance (ST-043): every maintenance task of the plan that is due today on a machine it applies to, with
 * those machines – computed when the page loads (ADR 0002). The tasks with the most overdue machines first, then the
 * most due machines, then by name (user, 2026-10-15); within a task its machines by location.
 *
 * Last done is the task's start date – or the machine's registration date if it was registered later (HS-20). The
 * latest maintenance record *done* follows with ST-044, machines *Not on display* with ST-056.
 */
export async function dueMaintenance(
  db: Database,
  clock: Clock,
  machines: readonly MaintainedMachine[],
): Promise<DueMaintenanceTask[]> {
  const now = today(clock);
  const { maintenanceTasks } = await maintenancePlan(db);
  const due = maintenanceTasks.flatMap((task) => {
    const dueMachines = machines.flatMap((machine) => {
      if (!maintenanceTaskAppliesTo(task, machine)) return [];
      const registered = calendarDate(machine.registeredAt);
      const lastDone = registered > task.startDate ? registered : task.startDate;
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
        overdue: dueMachines.filter((machine) => machine.overdue).length,
      },
    ];
  });
  return due.sort(
    (a, b) => b.overdue - a.overdue || b.machines.length - a.machines.length || a.name.localeCompare(b.name, "de"),
  );
}

/** By location as people read it – "row 2" before "row 10" –, then by museum number. */
function byLocation(a: DueMachine, b: DueMachine): number {
  return (
    a.location.localeCompare(b.location, "de", { numeric: true }) ||
    a.museumNumber.localeCompare(b.museumNumber, "de", { numeric: true })
  );
}
