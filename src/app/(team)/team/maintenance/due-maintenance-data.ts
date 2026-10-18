import { machineLabels, machinesForMaintenance } from "@/modules/collection";
import {
  dueMaintenance,
  maintenanceRecordById,
  maintenanceRecordedIn,
  type DueMaintenanceTask,
} from "@/modules/maintenance";
import type { Clock } from "@/platform/clock";
import { isId, lastCommandBy, type Database } from "@/platform/command";
import type { Viewer } from "../claimant";

/** What the due maintenance list is narrowed to (ST-043): only tasks suitable for helpers, and the chosen task. */
export type DueMaintenanceFilter = {
  suitableForHelpers?: boolean;
  /** The maintenance task whose machines are shown (G4a) – none: only the tasks with their counts. */
  maintenanceTaskId?: string;
  /** The maintenance record the team member just made (ST-044) – for the confirmation (G3). */
  recorded?: string;
};

/** An entry of the list's first step: a due maintenance task by name, with its counts (G4a). */
export type DueMaintenanceEntry = { id: string; name: string; machineCount: number; overdueCount: number };

export type DueMaintenanceData = {
  tasks: DueMaintenanceEntry[];
  /** The chosen task with its machines – only one that is due and matches the filter. */
  chosen: DueMaintenanceTask | undefined;
  /** The machine the team member just recorded maintenance on – only when the record is theirs (G3). */
  confirmed: { museumNumber: string } | undefined;
  filter: DueMaintenanceFilter;
};

/** The list's address with the filter – the counterpart of `dueMaintenanceFilterOf`. */
export function dueMaintenanceAddress({ suitableForHelpers, maintenanceTaskId }: DueMaintenanceFilter): string {
  const params = new URLSearchParams();
  if (maintenanceTaskId) params.set("task", maintenanceTaskId);
  if (suitableForHelpers) params.set("helpers", "1");
  const query = params.toString();
  return `/team/maintenance${query ? `?${query}` : ""}`;
}

/** The filter in the address – plain GET parameters, so the list works without JavaScript. */
export function dueMaintenanceFilterOf(params: Record<string, string | string[] | undefined>): DueMaintenanceFilter {
  const single = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const task = single(params.task);
  const recorded = single(params.recorded);
  return {
    ...(single(params.helpers) === "1" ? { suitableForHelpers: true } : {}),
    ...(task ? { maintenanceTaskId: task } : {}),
    ...(recorded ? { recorded } : {}),
  };
}

/**
 * The due maintenance list's data (ST-043): Collection's machines and Maintenance's due maintenance tasks on them – the
 * page composes (ST-009) –, computed for today. `viewer` is the team member looking at the list: Maintenance says on
 * which due machines they may record maintenance (ST-044, G11), and only their own record is confirmed.
 */
export async function loadDueMaintenance(
  db: Database,
  clock: Clock,
  filter: DueMaintenanceFilter,
  viewer?: Viewer,
): Promise<DueMaintenanceData> {
  const machines = await machinesForMaintenance(db);
  const due = (await dueMaintenance(db, clock, machines, viewer)).filter(
    (task) => !filter.suitableForHelpers || task.suitableForHelpers,
  );
  return {
    tasks: due.map((task) => ({
      id: task.id,
      name: task.name,
      machineCount: task.machines.length,
      overdueCount: task.overdueCount,
    })),
    chosen: due.find((task) => task.id === filter.maintenanceTaskId),
    confirmed: await confirmedRecord(db, filter.recorded, viewer),
    filter,
  };
}

/**
 * The machine of the maintenance record the address names – only when recording it was the latest command on it and
 * the viewer ran it, as everywhere (G3, architecture review 2026-10-18).
 */
async function confirmedRecord(db: Database, recordId: string | undefined, viewer: Viewer | undefined) {
  if (!recordId || !viewer || !isId(recordId)) return undefined;
  const command = await lastCommandBy(db, { aggregateId: recordId }, viewer.id);
  if (!command || !maintenanceRecordedIn(command, recordId)) return undefined;
  const record = await maintenanceRecordById(db, recordId);
  if (!record) return undefined;
  const label = (await machineLabels(db, [record.machineId])).get(record.machineId);
  return label && { museumNumber: label.museumNumber };
}
