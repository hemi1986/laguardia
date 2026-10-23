import { technologiesOf, type MachineCategory, type Technology } from "@/modules/collection";
import type { ActorOf, Decision, DecisionContext, TeamMemberId } from "@/platform/command";
import { isCalendarDate, type CalendarDate } from "@/platform/time";
import type { MaintenancePlan, MaintenanceTask } from "./maintenance-plan";

/**
 * CMD-ChangeMaintenancePlan (AGG-MaintenancePlan): a technician changes the museum-wide maintenance plan – adds a
 * maintenance task (ST-040), changes one or removes it (ST-041).
 */

/** Who may change the maintenance plan – technicians only. */
export const maintenancePlanActors = ["technician"] as const;

type ChangingPerson = ActorOf<(typeof maintenancePlanActors)[number]>;

/** A maintenance task as the technician gives it – nothing given is undefined, and the decision says what is missing. */
export type NewMaintenanceTask = {
  name: string;
  instruction: string;
  intervalMonths: number | undefined;
  suitableForHelpers: boolean;
  machineCategory: MachineCategory | undefined;
  technology: Technology | undefined;
  startDate: CalendarDate | undefined;
};

/** The details of a maintenance task – everything but its name, which a change keeps (ST-041). */
export type MaintenanceTaskDetails = Omit<NewMaintenanceTask, "name">;

export type ChangeMaintenancePlanInput = {
  /** The version of the maintenance plan the technician saw (HS-16). */
  version: number;
} & (
  | { change: "add"; task: NewMaintenanceTask }
  | { change: "change"; maintenanceTaskId: string; task: MaintenanceTaskDetails }
  | { change: "remove"; maintenanceTaskId: string }
);

/** What a change of the maintenance plan did to one maintenance task. */
export type MaintenancePlanChange = "added" | "changed" | "removed";

export type MaintenancePlanChanged = {
  type: "EVT-MaintenancePlanChanged";
  maintenanceTaskId: string;
  change: MaintenancePlanChange;
  changedBy: TeamMemberId;
};

export type ChangeMaintenancePlanError =
  | "name-required"
  | "instruction-required"
  | "interval-not-positive"
  | "interval-too-long"
  | "start-date-required"
  | "start-date-out-of-range"
  | "technology-without-machine-category"
  | "technology-does-not-fit-machine-category"
  | "maintenance-task-unknown";

/**
 * Technical limits, not rules of the domain (ST-040 code review, 2026-10-15): beyond them the calendar arithmetic of
 * due dates (ST-003) leaves four-digit years, and the maintenance plan could no longer be shown.
 */
export const LONGEST_INTERVAL_MONTHS = 1200;
export const EARLIEST_START_DATE = "1900-01-01";
export const LATEST_START_DATE = "2999-12-31";

export function changeMaintenancePlan(
  plan: MaintenancePlan,
  input: ChangeMaintenancePlanInput,
  { actor, clock, newId }: DecisionContext<ChangingPerson>,
): Decision<MaintenancePlan, MaintenancePlanChanged, ChangeMaintenancePlanError> {
  const changed = (maintenanceTasks: MaintenanceTask[], maintenanceTaskId: string, change: MaintenancePlanChange) => ({
    ok: true as const,
    state: { ...plan, maintenanceTasks },
    events: [{ type: "EVT-MaintenancePlanChanged" as const, maintenanceTaskId, change, changedBy: actor.teamMemberId }],
  });

  if (input.change === "add") {
    const name = input.task.name.trim();
    if (!name) return { ok: false, error: "name-required" };
    const details = detailsOf(input.task);
    if (!details.ok) return details;
    // The start date counts as last done: the task is first due one interval later (HS-12).
    const added: MaintenanceTask = { id: newId(), name, ...details.details, removedAt: undefined };
    return changed([...plan.maintenanceTasks, added], added.id, "added");
  }

  // A removed maintenance task is gone from the plan: it is never changed or removed again (invariant, ST-041).
  const existing = plan.maintenanceTasks.find((task) => task.id === input.maintenanceTaskId && !task.removedAt);
  if (!existing) return { ok: false, error: "maintenance-task-unknown" };
  const replaced = (task: MaintenanceTask) => plan.maintenanceTasks.map((each) => (each.id === task.id ? task : each));

  if (input.change === "remove") {
    // Its maintenance records are kept – they refer to the task, which stays stored with `removedAt` (ST-041).
    return changed(replaced({ ...existing, removedAt: clock.now() }), existing.id, "removed");
  }
  const details = detailsOf(input.task);
  if (!details.ok) return details;
  return changed(replaced({ ...existing, ...details.details }), existing.id, "changed");
}

/** The rules every maintenance task keeps, whether added or changed (AGG-MaintenancePlan invariants). */
function detailsOf(
  task: MaintenanceTaskDetails,
):
  | { ok: true; details: Omit<MaintenanceTask, "id" | "name" | "removedAt"> }
  | { ok: false; error: ChangeMaintenancePlanError } {
  const instruction = task.instruction.trim();
  if (!instruction) return { ok: false, error: "instruction-required" };
  if (task.intervalMonths === undefined || !Number.isInteger(task.intervalMonths) || task.intervalMonths < 1) {
    return { ok: false, error: "interval-not-positive" };
  }
  if (task.intervalMonths > LONGEST_INTERVAL_MONTHS) return { ok: false, error: "interval-too-long" };
  if (!task.startDate || !isCalendarDate(task.startDate)) return { ok: false, error: "start-date-required" };
  if (task.startDate < EARLIEST_START_DATE || task.startDate > LATEST_START_DATE) {
    return { ok: false, error: "start-date-out-of-range" };
  }
  // A restriction to a technology fits the restricted machine category (AGG-MaintenancePlan invariant, HS-10).
  if (task.technology && !task.machineCategory) return { ok: false, error: "technology-without-machine-category" };
  if (task.technology && task.machineCategory && !technologiesOf(task.machineCategory).includes(task.technology)) {
    return { ok: false, error: "technology-does-not-fit-machine-category" };
  }
  return {
    ok: true,
    details: {
      instruction,
      intervalMonths: task.intervalMonths,
      suitableForHelpers: task.suitableForHelpers,
      machineCategory: task.machineCategory,
      technology: task.technology,
      startDate: task.startDate,
    },
  };
}
