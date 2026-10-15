import { technologiesOf, type MachineCategory, type Technology } from "@/modules/collection";
import type { ActorOf, Decision, DecisionContext, TeamMemberId } from "@/platform/command";
import { isCalendarDate, type CalendarDate } from "@/platform/time";
import type { MaintenancePlan, MaintenanceTask } from "./maintenance-plan";

/**
 * CMD-ChangeMaintenancePlan (AGG-MaintenancePlan): a technician changes the museum-wide maintenance plan – for now by
 * adding a maintenance task (ST-040); changing and removing one follow with ST-041.
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

export type ChangeMaintenancePlanInput = {
  /** The version of the maintenance plan the technician saw (HS-16). */
  version: number;
  change: "add";
  task: NewMaintenanceTask;
};

export type MaintenancePlanChanged = {
  type: "EVT-MaintenancePlanChanged";
  maintenanceTaskId: string;
  change: "added";
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
  | "technology-does-not-fit-machine-category";

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
  { actor, newId }: DecisionContext<ChangingPerson>,
): Decision<MaintenancePlan, MaintenancePlanChanged, ChangeMaintenancePlanError> {
  const { task } = input;
  const name = task.name.trim();
  if (!name) return { ok: false, error: "name-required" };
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
  const added: MaintenanceTask = {
    id: newId(),
    name,
    instruction,
    intervalMonths: task.intervalMonths,
    suitableForHelpers: task.suitableForHelpers,
    machineCategory: task.machineCategory,
    technology: task.technology,
    // The start date counts as last done: the task is first due one interval later (HS-12).
    startDate: task.startDate,
    removedAt: undefined,
  };
  return {
    ok: true,
    state: { ...plan, maintenanceTasks: [...plan.maintenanceTasks, added] },
    events: [
      {
        type: "EVT-MaintenancePlanChanged",
        maintenanceTaskId: added.id,
        change: "added",
        changedBy: actor.teamMemberId,
      },
    ],
  };
}
