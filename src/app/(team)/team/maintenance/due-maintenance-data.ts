import { machinesForMaintenance } from "@/modules/collection";
import { dueMaintenance, type DueMaintenanceTask } from "@/modules/maintenance";
import type { Clock } from "@/platform/clock";
import type { Database } from "@/platform/command";

/** What the due maintenance list is narrowed to (ST-043): only tasks suitable for helpers, and the chosen task. */
export type DueMaintenanceFilter = {
  suitableForHelpers?: boolean;
  /** The maintenance task whose machines are shown (G4a) – none: only the tasks with their counts. */
  maintenanceTaskId?: string;
};

/** An entry of the list's first step: a due maintenance task by name, with its counts (G4a). */
export type DueMaintenanceEntry = { id: string; name: string; machines: number; overdue: number };

export type DueMaintenanceData = {
  tasks: DueMaintenanceEntry[];
  /** The chosen task with its machines – only one that is due and matches the filter. */
  chosen: DueMaintenanceTask | undefined;
  filter: DueMaintenanceFilter;
};

/** The filter in the address – plain GET parameters, so the list works without JavaScript. */
export function dueMaintenanceFilterOf(params: Record<string, string | string[] | undefined>): DueMaintenanceFilter {
  const single = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const task = single(params.task);
  return {
    ...(single(params.helpers) === "1" ? { suitableForHelpers: true } : {}),
    ...(task ? { maintenanceTaskId: task } : {}),
  };
}

/**
 * The due maintenance list's data (ST-043): Collection's machines and Maintenance's due maintenance tasks on them – the
 * page composes (ST-009) –, computed for today.
 */
export async function loadDueMaintenance(
  db: Database,
  clock: Clock,
  filter: DueMaintenanceFilter,
): Promise<DueMaintenanceData> {
  const due = (await dueMaintenance(db, clock, await machinesForMaintenance(db))).filter(
    (task) => !filter.suitableForHelpers || task.suitableForHelpers,
  );
  return {
    tasks: due.map((task) => ({ id: task.id, name: task.name, machines: task.machines.length, overdue: task.overdue })),
    chosen: due.find((task) => task.id === filter.maintenanceTaskId),
    filter,
  };
}
