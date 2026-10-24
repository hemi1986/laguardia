import { machineForMaintenance, machineLabels, machinesForMaintenance } from "@/modules/collection";
import {
  dueMaintenance,
  maintenanceForRecording,
  maintenanceRecordById,
  maintenanceTaskName as maintenanceTaskNameOf,
  maintenanceRecordedIn,
  type DueMaintenanceTask,
} from "@/modules/maintenance";
import type { Clock } from "@/platform/clock";
import { isId, lastCommandBy, type Database } from "@/platform/command";
import type { TeamCommandErrorCode } from "@/platform/messages";
import type { Viewer } from "../claimant";

/** What the due maintenance list is narrowed to (ST-043): only tasks suitable for helpers, and the chosen task. */
export type DueMaintenanceFilter = {
  suitableForHelpers?: boolean;
  /** The maintenance task whose machines are shown (G4a) – none: only the tasks with their counts. */
  maintenanceTaskId?: string;
  /** The maintenance records the team member just made (ST-044, ST-045) – for the confirmation (G3). */
  recorded?: readonly string[];
  /** The machines recording for several machines left out (ST-045) – their reason is Maintenance's, not the address's. */
  notRecorded?: readonly string[];
};

/** An entry of the list's first step: a due maintenance task by name, with its counts (G4a). */
export type DueMaintenanceEntry = { id: string; name: string; machineCount: number; overdueCount: number };

export type DueMaintenanceData = {
  tasks: DueMaintenanceEntry[];
  /** The chosen task with its machines – only one that is due and matches the filter. */
  chosen: DueMaintenanceTask | undefined;
  /**
   * The machines the team member just recorded maintenance on – only the records that are theirs (G3) –, the
   * maintenance task's name, and the machines left out with the reason Maintenance gives now (ST-045, G23).
   */
  confirmed: Confirmed | undefined;
  filter: DueMaintenanceFilter;
};

export type Confirmed = {
  maintenanceTaskName: string;
  museumNumbers: string[];
  notRecorded: { museumNumber: string; reason: TeamCommandErrorCode }[];
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
  const all = (value: string | string[] | undefined) => (value === undefined ? [] : [value].flat());
  const task = single(params.task);
  const recorded = all(params.recorded);
  const notRecorded = all(params.notRecorded);
  return {
    ...(single(params.helpers) === "1" ? { suitableForHelpers: true } : {}),
    ...(task ? { maintenanceTaskId: task } : {}),
    ...(recorded.length > 0 ? { recorded } : {}),
    ...(notRecorded.length > 0 ? { notRecorded } : {}),
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
    confirmed: await confirmedRecords(db, clock, filter, viewer),
    filter,
  };
}

/**
 * The machines of the maintenance records the address names – each only when recording it was the latest command on it
 * and the viewer ran it, as everywhere (G3, architecture review 2026-10-18). The machines named as not recorded get a
 * line only next to a confirmation, and only with the reason Maintenance gives the viewer now (ST-045, G23).
 */
async function confirmedRecords(
  db: Database,
  clock: Clock,
  { recorded = [], notRecorded = [] }: DueMaintenanceFilter,
  viewer: Viewer | undefined,
): Promise<Confirmed | undefined> {
  if (!viewer) return undefined;
  const records = (
    await Promise.all(
      recorded.filter(isId).map(async (recordId) => {
        const command = await lastCommandBy(db, { aggregateId: recordId }, viewer.id);
        return command && maintenanceRecordedIn(command, recordId) ? maintenanceRecordById(db, recordId) : undefined;
      }),
    )
  ).filter((record) => record !== undefined);
  if (records.length === 0) return undefined;
  const { maintenanceTaskId } = records[0];
  const leftOut = notRecorded.filter(isId);
  const [maintenanceTaskName, labels, reasons] = await Promise.all([
    maintenanceTaskNameOf(db, maintenanceTaskId),
    machineLabels(db, [...records.map((record) => record.machineId), ...leftOut]),
    Promise.all(leftOut.map((machineId) => reasonNotRecorded(db, clock, maintenanceTaskId, machineId, viewer))),
  ]);
  return {
    maintenanceTaskName: maintenanceTaskName ?? "",
    museumNumbers: records.flatMap((record) => labels.get(record.machineId)?.museumNumber ?? []),
    notRecorded: leftOut.flatMap((machineId, index) => {
      const museumNumber = labels.get(machineId)?.museumNumber;
      const reason = reasons[index];
      return museumNumber && reason ? [{ museumNumber, reason }] : [];
    }),
  };
}

/** Why CMD-RecordMaintenance would refuse the viewer the task on the machine now – none if it would not. */
async function reasonNotRecorded(
  db: Database,
  clock: Clock,
  maintenanceTaskId: string,
  machineId: string,
  viewer: Viewer,
): Promise<TeamCommandErrorCode | undefined> {
  // A page runs no command: no retirement lock (ADR 0010).
  const machine = await machineForMaintenance(db, machineId, { inCommand: false });
  if (!machine) return "unknown-machine";
  const recording = await maintenanceForRecording(db, clock, maintenanceTaskId, machine, viewer);
  return recording ? recording.whyNot : "maintenance-task-unknown";
}
