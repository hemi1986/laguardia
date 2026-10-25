import { machinesForMaintenance } from "@/modules/collection";
import type { Clock } from "@/platform/clock";
import type { Database, Role } from "@/platform/command";
import type { CalendarDate } from "@/platform/time";
import { dueOn } from "./due-maintenance";
import { latestMaintenanceRecords, type NamedMaintenanceRecord } from "./maintenance-records";

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
  /** Its latest maintenance records, the newest first – at most the `latestRecords` asked for. */
  latestRecords: NamedMaintenanceRecord[];
  /** How many maintenance records it has in all. */
  recordCount: number;
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
  { teamMember, latestRecords }: { teamMember: { role: Role }; latestRecords: number },
): Promise<MachineMaintenance> {
  const [machines, latest] = await Promise.all([
    machinesForMaintenance(db, { machineId }),
    latestMaintenanceRecords(db, machineId, latestRecords),
  ]);
  const due = await dueOn(db, clock, machines, teamMember);
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
  };
}
