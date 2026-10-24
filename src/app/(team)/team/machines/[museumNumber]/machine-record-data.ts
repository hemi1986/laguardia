import {
  machineRecord,
  machinesForMaintenance,
  machineStatusesToChangeTo,
  type MachineRecord,
  type Retirement,
  type StatusChange,
  retireRefusal,
} from "@/modules/collection";
import { dueMaintenance, maintenanceRecords, type NamedMaintenanceRecord } from "@/modules/maintenance";
import { openDefects, recentRepairHistory, type EndedRepairHistoryEntry } from "@/modules/repair";
import { teamMemberNames } from "@/modules/team";
import { systemClock, type Clock } from "@/platform/clock";
import type { Database } from "@/platform/command";
import type { CalendarDate } from "@/platform/time";
import type { Viewer } from "../../claimant";
import { shownOpenDefects, type OpenDefectsItem } from "../../defects/open-defects-data";

/** A status change as the machine record shows it: who changed it by name, not by ID. */
export type NamedStatusChange = Omit<StatusChange, "changedBy"> & { changedBy: string | undefined };

/** The machine record with names – what the page shows (ST-009). */
export type MachineRecordData = Omit<MachineRecord, "statusHistory" | "retirement"> & {
  statusHistory: NamedStatusChange[];
  retirement?: Omit<Retirement, "retiredBy"> & { retiredBy: string | undefined };
  /** Section 4 (ST-033): its open defects, as the open defects list shows them – high priority first. */
  openDefects: OpenDefectsItem[];
  /** Section 7 (ST-033): its most recently ended entries of the repair history, the most recently ended first – at most `RECENT_REPAIR_HISTORY_ENTRIES`. */
  recentRepairHistory: ShownEndedRepairHistoryEntry[];
  /** How many entries its whole repair history has – open defects included (ST-033). */
  repairHistoryCount: number;
  /** Section 5 (ST-047): its due maintenance tasks and latest maintenance records – Maintenance's. */
  maintenance: MachineMaintenance;
  /** The machine record's own actions the viewer may take (G11) – a section another module decides per item brings its own offer. */
  actions: MachineRecordActions;
};

/**
 * The actions of the machine record the viewer may take (G11), decided once with the record (architecture review
 * 2026-10-18) – the page and its sections only show them. The commands check again.
 */
export type MachineRecordActions = {
  /** Section 2 (ST-015): every team member, not for a retired machine. */
  reportProblem: boolean;
  /** Section 3 (ST-034): every team member, not for a retired machine. */
  changeLocation: boolean;
  /** Section 3 (ST-012): only where the viewer has a machine status to set – none for a retired machine. */
  changeStatus: boolean;
  /** Section 8 (ST-037): every team member, a retired machine's record too. */
  attachFile: boolean;
  /** Section 9 (ST-039): technicians only, not for a retired machine – Collection's own rule. */
  retire: boolean;
};

/** Section 5 „Wartung“ (ST-047): what Maintenance says about the machine, with Team's names. */
export type MachineMaintenance = {
  /** Not on display: nothing becomes due (ST-056) – said in place of the due maintenance tasks. */
  notOnDisplay: boolean;
  /** Its due maintenance tasks – the overdue ones first, then the longest due. */
  due: MachineDueMaintenanceTask[];
  /** Its latest maintenance records, the newest first – at most `LATEST_MAINTENANCE_RECORDS`. */
  latestRecords: ShownMaintenanceRecord[];
  /** How many maintenance records it has in all. */
  recordCount: number;
};

/** A maintenance task due on the machine; `recordOffered`: Maintenance would accept the viewer recording it (G11). */
export type MachineDueMaintenanceTask = {
  maintenanceTaskId: string;
  name: string;
  dueSince: CalendarDate;
  overdue: boolean;
  recordOffered: boolean;
};

/** A maintenance record as the machine record shows it – who recorded it by name. */
export type ShownMaintenanceRecord = Omit<NamedMaintenanceRecord, "recordedBy"> & { recordedBy: string | undefined };

/** How many of the latest maintenance records the machine record shows (user, backlog grooming 2026-10-17). */
export const LATEST_MAINTENANCE_RECORDS = 5;

/** How many of the most recently ended entries of the repair history the machine record shows (user, 2026-10-14, `/implement ST-033`). */
export const RECENT_REPAIR_HISTORY_ENTRIES = 3;

/** An entry of the repair history that has ended, as section 7 shows it – who ended it by name. */
export type ShownEndedRepairHistoryEntry = Omit<EndedRepairHistoryEntry, "resolvedBy"> & {
  resolvedBy: string | undefined;
};

/**
 * The page's data: the Collection module's machine record, with the team members' names from the Team module, and the
 * Repair module's open defects and repair history (ST-033). The first read across two modules (ST-009): neither module
 * imports the other – the page composes their public queries. `clock` makes "open for … days" (ST-021); `viewer` is the
 * team member looking at the page – one's own claim is said as such (ST-025), and what they may do here is decided by
 * their role (`actions`).
 */
export async function loadMachineRecord(
  db: Database,
  museumNumber: string,
  { clock = systemClock, viewer }: { clock?: Clock; viewer: Viewer },
): Promise<MachineRecordData | undefined> {
  const record = await machineRecord(db, museumNumber);
  if (!record) return undefined;
  const [open, recent, forMaintenance, records] = await Promise.all([
    openDefects(db, { machineId: record.id }),
    recentRepairHistory(db, record.id, RECENT_REPAIR_HISTORY_ENTRIES),
    machinesForMaintenance(db, { machineId: record.id }),
    maintenanceRecords(db, { machineId: record.id }),
  ]);
  const latestRecords = records.slice(0, LATEST_MAINTENANCE_RECORDS);
  const ids = [
    ...record.statusHistory.map((change) => change.changedBy),
    record.retirement?.retiredBy,
    ...recent.entries.map((entry) => entry.resolvedBy),
    ...latestRecords.map((maintenance) => maintenance.recordedBy),
  ];
  const [names, shownOpen, due] = await Promise.all([
    teamMemberNames(
      db,
      ids.filter((id): id is string => id !== undefined),
    ),
    shownOpenDefects(db, clock, open, viewer),
    dueMaintenance(db, clock, forMaintenance, viewer),
  ]);
  return {
    ...record,
    statusHistory: record.statusHistory.map((change) => ({ ...change, changedBy: names.get(change.changedBy) })),
    retirement: record.retirement && { ...record.retirement, retiredBy: names.get(record.retirement.retiredBy) },
    openDefects: shownOpen,
    recentRepairHistory: recent.entries.map((entry) => ({ ...entry, resolvedBy: names.get(entry.resolvedBy) })),
    repairHistoryCount: recent.total,
    maintenance: {
      notOnDisplay: record.machineStatus === "not-on-display",
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
      latestRecords: latestRecords.map((maintenance) => ({
        ...maintenance,
        recordedBy: names.get(maintenance.recordedBy),
      })),
      recordCount: records.length,
    },
    actions: actionsOf(record, viewer),
  };
}

function actionsOf(record: MachineRecord, viewer: Viewer): MachineRecordActions {
  const active = record.retirement === undefined;
  return {
    reportProblem: active,
    changeLocation: active,
    changeStatus:
      machineStatusesToChangeTo(viewer.role, { machineStatus: record.machineStatus, retired: !active }).length > 0,
    attachFile: true,
    retire: retireRefusal({ retired: !active }, viewer) === undefined,
  };
}
