import type { ActorOf, Decision, DecisionContext, TeamMemberId } from "@/platform/command";
import type { ChosenMachines } from "./chosen-machines";
import type { MaintenancePlan, MaintenanceTask } from "./maintenance-plan";
import { withMachinesChanged } from "./machines-of-maintenance-task";

/**
 * CMD-ChangeMaintenancePlan (AGG-MaintenancePlan): a technician changes the museum-wide maintenance plan – adds a
 * maintenance task with the machines it applies to (ST-040, ST-094), changes one or removes it (ST-041).
 */

/** Who may change the maintenance plan – technicians only. */
export const maintenancePlanActors = ["technician"] as const;

type ChangingPerson = ActorOf<(typeof maintenancePlanActors)[number]>;

/** The details of a maintenance task – everything but its name, which a change keeps (ST-041) and its machines. */
export type MaintenanceTaskDetails = {
  instruction: string;
  intervalMonths: number | undefined;
  suitableForHelpers: boolean;
};

/**
 * A maintenance task as the technician gives it – nothing given is undefined, and the decision says what is missing.
 * `machineIds` are the machines it applies to (none is allowed), exactly as posted: a forged step may name one La Guardia
 * does not know, or one twice.
 */
export type NewMaintenanceTask = MaintenanceTaskDetails & { name: string; machineIds: readonly string[] };

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

/** EVT-MachinesOfMaintenanceTaskChanged – names no single machine: the machines added (and removed) in one step. */
export type MachinesOfMaintenanceTaskChanged = {
  type: "EVT-MachinesOfMaintenanceTaskChanged";
  maintenanceTaskId: string;
  machinesAdded: readonly string[];
  machinesRemoved: readonly string[];
  changedBy: TeamMemberId;
};

export type ChangeMaintenancePlanError =
  | "name-required"
  | "instruction-required"
  | "interval-not-positive"
  | "interval-too-long"
  | "maintenance-task-unknown"
  | "unknown-machine"
  | "machine-retired"
  | "machine-chosen-twice";

/**
 * Technical limit, not a rule of the domain (ST-040 code review, 2026-10-15): beyond it the calendar arithmetic of due
 * dates (ST-003) leaves four-digit years, and the maintenance plan could no longer be shown.
 */
export const LONGEST_INTERVAL_MONTHS = 1200;

export function changeMaintenancePlan(
  plan: MaintenancePlan,
  input: ChangeMaintenancePlanInput,
  { actor, clock, newId }: DecisionContext<ChangingPerson>,
  chosen: ChosenMachines,
): Decision<MaintenancePlan, MaintenancePlanChanged | MachinesOfMaintenanceTaskChanged, ChangeMaintenancePlanError> {
  const changed = (
    maintenanceTasks: MaintenanceTask[],
    maintenanceTaskId: string,
    change: MaintenancePlanChange,
    machineIds: readonly string[] = [],
  ) => ({
    ok: true as const,
    state: withMachinesChanged(
      { ...plan, maintenanceTasks },
      maintenanceTaskId,
      { added: machineIds, removed: [] },
      { now: clock.now(), newId },
    ),
    events: [
      { type: "EVT-MaintenancePlanChanged" as const, maintenanceTaskId, change, changedBy: actor.teamMemberId },
      // A change that adds nothing records no event for the machines.
      ...(machineIds.length === 0
        ? []
        : [
            {
              type: "EVT-MachinesOfMaintenanceTaskChanged" as const,
              maintenanceTaskId,
              machinesAdded: [...machineIds],
              machinesRemoved: [],
              changedBy: actor.teamMemberId,
            },
          ]),
    ],
  });

  if (input.change === "add") {
    const name = input.task.name.trim();
    if (!name) return { ok: false, error: "name-required" };
    const details = detailsOf(input.task);
    if (!details.ok) return details;
    // Only the machines of a sent step that La Guardia knows, once each, and not retired – or the whole step is
    // rejected (HS-22: a task and its machines are stored together or not at all).
    const refusal = machinesRefusal(input.task.machineIds, chosen);
    if (refusal) return { ok: false, error: refusal };
    const added: MaintenanceTask = { id: newId(), name, ...details.details, removedAt: undefined };
    // The task is due at once on every machine it newly applies to: from the moment it was added (HS-24).
    return changed([...plan.maintenanceTasks, added], added.id, "added", input.task.machineIds);
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

/**
 * Why the chosen machines cannot be the machines of a maintenance task – none if they can. Of the `toCheck` among them
 * (all of them unless said otherwise) each must be known and not retired; a machine chosen twice is refused in any case.
 */
export function machinesRefusal(
  machineIds: readonly string[],
  chosen: ChosenMachines,
  toCheck: readonly string[] = machineIds,
): Extract<ChangeMaintenancePlanError, "unknown-machine" | "machine-retired" | "machine-chosen-twice"> | undefined {
  if (new Set(machineIds).size !== machineIds.length) return "machine-chosen-twice";
  if (toCheck.some((machineId) => !chosen.has(machineId))) return "unknown-machine";
  if (toCheck.some((machineId) => chosen.get(machineId)?.retired)) return "machine-retired";
  return undefined;
}

/** The rules every maintenance task keeps, whether added or changed (AGG-MaintenancePlan invariants). */
function detailsOf(
  task: MaintenanceTaskDetails,
):
  | { ok: true; details: Pick<MaintenanceTask, "instruction" | "intervalMonths" | "suitableForHelpers"> }
  | { ok: false; error: ChangeMaintenancePlanError } {
  const instruction = task.instruction.trim();
  if (!instruction) return { ok: false, error: "instruction-required" };
  if (task.intervalMonths === undefined || !Number.isInteger(task.intervalMonths) || task.intervalMonths < 1) {
    return { ok: false, error: "interval-not-positive" };
  }
  if (task.intervalMonths > LONGEST_INTERVAL_MONTHS) return { ok: false, error: "interval-too-long" };
  return {
    ok: true,
    details: { instruction, intervalMonths: task.intervalMonths, suitableForHelpers: task.suitableForHelpers },
  };
}
