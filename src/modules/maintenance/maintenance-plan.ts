/**
 * A maintenance task of the maintenance plan (CONTEXT.md: Maintenance task; data model, ST-040): a recurring job with a
 * time-based interval in whole months, a short instruction and a *suitable for helpers* mark. Which machines it applies
 * to is a list of its own (`MachineOfTask`) – no restriction to a machine category or technology and no start date
 * (FLOW-PerMachineMaintenance, ST-094).
 */
export type MaintenanceTask = {
  id: string;
  name: string;
  instruction: string;
  /** Whole months, positive. */
  intervalMonths: number;
  suitableForHelpers: boolean;
  /** When it was removed (ST-041) – a removed maintenance task never becomes due again. */
  removedAt: Date | undefined;
};

/**
 * One of the machines a maintenance task applies to (data model: Machine of the task, CONTEXT.md: Machines of a
 * maintenance task): the machine and the moment it was added. The task is due at once from then on, and only done
 * maintenance records recorded since then count for last done (HS-24). A retired machine's entry stays and never counts.
 */
export type MachineOfTask = {
  id: string;
  maintenanceTaskId: string;
  machineId: string;
  addedAt: Date;
  /** When it was removed from the task (ST-095): it is no longer one of the machines of the task and never counts. */
  removedAt: Date | undefined;
};

/** The ID of the one maintenance plan – created by the migration `drizzle/0019_maintenance_plan.sql`. */
export const MAINTENANCE_PLAN_ID = "7a1e0f40-0000-4000-8000-000000000040";

/** AGG-MaintenancePlan – the single, museum-wide set of all maintenance tasks (CONTEXT.md: Maintenance plan). */
export type MaintenancePlan = {
  id: string;
  /** In the order they were added. */
  maintenanceTasks: MaintenanceTask[];
  /** The machines of all maintenance tasks, in the order they were added. */
  machinesOfTasks: MachineOfTask[];
};

/** A maintenance task with the IDs of the machines it applies to – retired ones may be among them (they never count). */
export type MaintenanceTaskWithMachines = MaintenanceTask & { machines: MachineOfTask[] };
