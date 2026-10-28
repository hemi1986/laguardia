import { machinesForMaintenance } from "@/modules/collection";
import type { Clock } from "@/platform/clock";
import type { Database, Role } from "@/platform/command";
import type { CalendarDate } from "@/platform/time";
import { changeMachinesOffered } from "./change-machines-of-maintenance-task";
import { dueOn } from "./due-maintenance";
import { latestMaintenanceRecords, type NamedMaintenanceRecord } from "./maintenance-records";
import { activeMaintenanceTasks } from "./maintenance-plans";
import { maintenanceTaskAppliesTo } from "./machines-of-maintenance-task";

/** A maintenance task due on the machine; `recordOffered`: CMD-RecordMaintenance would accept the team member (G11). */
export type MachineDueMaintenanceTask = {
  maintenanceTaskId: string;
  name: string;
  dueSince: CalendarDate;
  overdue: boolean;
  recordOffered: boolean;
};

/** Maintenance of one machine – what section 5 „Wartung“ of the machine record shows (ST-047). */
export type MachineMaintenance = {
  /** Not on display: nothing becomes due (ST-056) – said in place of the due maintenance tasks. */
  notOnDisplay: boolean;
  /** Its due maintenance tasks – the overdue ones first, then the longest due. */
  due: MachineDueMaintenanceTask[];
  /** Its latest maintenance records, the newest first – at most the `latestRecordCount` asked for. */
  latestRecords: NamedMaintenanceRecord[];
  /** How many maintenance records it has in all. */
  recordCount: number;
  /** How many maintenance tasks apply to it (ST-096) – none for a retired machine, which never counts. */
  taskCount: number;
  /** CMD-ChangeMachinesOfMaintenanceTask would accept the team member for this machine (ST-096, G11). */
  changeOffered: boolean;
};

/**
 * The maintenance of one machine (ST-047): its due maintenance tasks as RM-DueMaintenance computes them, whether it is
 * Not on display (ST-056), and its newest maintenance records – on the machine as Collection publishes it for
 * maintenance (context map), read here. A retired machine is not published for maintenance: nothing is due on it, and
 * its records stay. `teamMember` is who looks at it – each due task says whether they may record it (G11).
 */
export async function machineMaintenance(
  db: Database,
  clock: Clock,
  machineId: string,
  { teamMember, latestRecordCount }: { teamMember: { role: Role }; latestRecordCount: number },
): Promise<MachineMaintenance> {
  const published = machinesForMaintenance(db, { machineId });
  const [machines, due, latest, tasks] = await Promise.all([
    published,
    published.then((machines) => dueOn(db, clock, machines, teamMember)),
    latestMaintenanceRecords(db, machineId, latestRecordCount),
    activeMaintenanceTasks(db),
  ]);
  return {
    notOnDisplay: machines.some((machine) => machine.machineStatus === "not-on-display"),
    due: due
      .flatMap((task) =>
        task.machines.map(({ dueSince, overdue, recordOffered }) => ({
          maintenanceTaskId: task.id,
          name: task.name,
          dueSince,
          overdue,
          recordOffered,
        })),
      )
      .sort((a, b) => Number(b.overdue) - Number(a.overdue) || a.dueSince.localeCompare(b.dueSince)),
    latestRecords: latest.records,
    recordCount: latest.total,
    taskCount: machines.length === 0 ? 0 : tasks.filter((task) => maintenanceTaskAppliesTo(task, machineId)).length,
    changeOffered: machines.length > 0 && changeMachinesOffered(teamMember.role),
  };
}
