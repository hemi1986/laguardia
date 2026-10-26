import { machinesForMaintenance, type MachineForMaintenance } from "@/modules/collection";
import type { Clock } from "@/platform/clock";
import type { Database, Role } from "@/platform/command";
import { addDays, calendarDate, graceDays, maintenanceDates, today, type CalendarDate } from "@/platform/time";
import { activeMaintenanceTasks } from "./maintenance-plans";
import { lastDoneByRecord, lastDoneKey } from "./maintenance-records";
import { recordRefusal } from "./record-maintenance";

/** A machine on which a maintenance task is due (EVT-MaintenanceTaskDue, computed on read – ADR 0002). */
export type DueMachine = {
  machineId: string;
  museumNumber: string;
  machineModelTitle: string;
  location: string;
  /** None on a machine the task newly applies to and nobody has done it on yet – it is due at once (ST-094). */
  lastDone: CalendarDate | undefined;
  dueSince: CalendarDate;
  /** Due for more than 25 % of the interval (EVT-MaintenanceTaskOverdue, ST-003). */
  overdue: boolean;
  /**
   * Whether CMD-RecordMaintenance would accept the team member who asks recording the task here, so a page offers
   * „Wartung erfassen“ only where it will be accepted (ST-044, G11) – never when nobody asks.
   */
  recordOffered: boolean;
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
 * RM-DueMaintenance (ST-043) – on Collection's machines as it publishes them for maintenance (context map, read here
 * in one call): every maintenance task of the plan that is due today on a machine it applies to, with those machines
 * – computed when the page loads (ADR 0002). The tasks with the most overdue machines first, then the most due
 * machines, then by name (user, 2026-10-15); within a task its machines by location.
 *
 * A task applies to the machines a technician chose for it (ST-094). On a machine it newly applies to it is due at
 * once – since the day the machine was added –; last done is then the latest maintenance record *done* recorded since
 * (HS-24, ST-044) – a record *partially done* restarts nothing – and the interval runs on that machine alone. A machine
 * *Not on display* is never due; after its return a task that was already due counts from the return (ST-056).
 *
 * `teamMember` is who looks at it: each due machine says whether they may record the task there (ST-044, G11).
 */
export async function dueMaintenance(
  db: Database,
  clock: Clock,
  teamMember?: { role: Role },
): Promise<DueMaintenanceTask[]> {
  return dueOn(db, clock, await machinesForMaintenance(db), teamMember);
}

/**
 * RM-MachineOverview's number of overdue maintenance tasks (ST-057): per machine Collection publishes for maintenance,
 * how many maintenance tasks are overdue on it today, as RM-DueMaintenance computes them – a machine with none is left
 * out.
 */
export async function overdueMaintenanceCounts(db: Database, clock: Clock): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  for (const task of await dueMaintenance(db, clock)) {
    for (const machine of task.machines) {
      if (machine.overdue) counts.set(machine.machineId, (counts.get(machine.machineId) ?? 0) + 1);
    }
  }
  return counts;
}

/** RM-DueMaintenance on the given machines – for the module's answers that already hold Collection's machines. */
export async function dueOn(
  db: Database,
  clock: Clock,
  machines: readonly MachineForMaintenance[],
  teamMember?: { role: Role },
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
      const added = task.machines.find((each) => each.machineId === machine.id);
      // A machine Not on display is never due; maintenance recorded there still counts (HS-13, ST-056).
      if (!added || machine.machineStatus === "not-on-display") return [];
      const lastDone = recorded.get(lastDoneKey(task.id, machine.id));
      const { dueDate, overdueFrom } = dueAfterReturn(
        lastDone ? maintenanceDates(lastDone, task.intervalMonths) : dueAtOnce(calendarDate(added.addedAt), task.intervalMonths),
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
          recordOffered: !!teamMember && recordRefusal(task, machine, teamMember) === undefined,
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
export function byLocation(
  a: { location: string; museumNumber: string },
  b: { location: string; museumNumber: string },
): number {
  return (
    a.location.localeCompare(b.location, "de", { numeric: true }) ||
    a.museumNumber.localeCompare(b.museumNumber, "de", { numeric: true })
  );
}

/**
 * A task that newly applies to a machine is due at once, since the day the machine was added (ST-094); overdue 25 % of
 * the actual days of the interval *starting on that day* after it, like a task due on the return (`graceDays`).
 */
function dueAtOnce(
  addedOn: CalendarDate,
  intervalMonths: number,
): { dueDate: CalendarDate; overdueFrom: CalendarDate } {
  return { dueDate: addedOn, overdueFrom: addDays(addedOn, graceDays(addedOn, intervalMonths)) };
}

/**
 * Back on display (HS-20, as revised in D5; ST-056): a task already due when the machine returned counts as due since
 * the return, and overdue 25 % of the actual days of the interval *starting on the return* after it – the time
 * convention's `graceDays(start, months)` was built for this start (ST-003, engineering conventions); any other task
 * keeps its normal dates.
 */
function dueAfterReturn(
  dates: { dueDate: CalendarDate; overdueFrom: CalendarDate },
  returnedOn: CalendarDate | undefined,
  intervalMonths: number,
): { dueDate: CalendarDate; overdueFrom: CalendarDate } {
  if (!returnedOn || dates.dueDate >= returnedOn) return dates;
  return { dueDate: returnedOn, overdueFrom: addDays(returnedOn, graceDays(returnedOn, intervalMonths)) };
}
