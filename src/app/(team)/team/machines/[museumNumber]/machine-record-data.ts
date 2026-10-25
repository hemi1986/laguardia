import {
  machineRecord,
  machineStatusesToChangeTo,
  type MachineRecord,
  type Retirement,
  type StatusChange,
  retireRefusal,
} from "@/modules/collection";
import { machineMaintenance, type MachineMaintenance, type NamedMaintenanceRecord } from "@/modules/maintenance";
import { openDefects, recentRepairHistory, type EndedRepairHistoryEntry } from "@/modules/repair";
import { systemClock, type Clock } from "@/platform/clock";
import type { Database } from "@/platform/command";
import type { Viewer } from "../../claimant";
import { openDefectReferences, shownOpenDefects, type OpenDefectsItem } from "../../defects/open-defects-data";
import { named } from "../../named";

/** A status change as the machine record shows it: who changed it by name, not by ID. */
export type NamedStatusChange = Omit<StatusChange, "changedBy"> & { changedBy: string };

/** The machine record with names – what the page shows (ST-009). */
export type MachineRecordData = Omit<MachineRecord, "statusHistory" | "retirement"> & {
  statusHistory: NamedStatusChange[];
  retirement?: Omit<Retirement, "retiredBy"> & { retiredBy: string };
  /** Section 4 (ST-033): its open defects, as the open defects list shows them – high priority first. */
  openDefects: OpenDefectsItem[];
  /** Section 7 (ST-033): its most recently ended entries of the repair history, the most recently ended first – at most `RECENT_REPAIR_HISTORY_ENTRIES`. */
  recentRepairHistory: ShownEndedRepairHistoryEntry[];
  /** How many entries its whole repair history has – open defects included (ST-033). */
  repairHistoryCount: number;
  /** Section 5 (ST-047): its due maintenance tasks and latest maintenance records – Maintenance's. */
  maintenance: ShownMachineMaintenance;
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

/** Section 5 „Wartung“ (ST-047): Maintenance's answer for the machine, with Team's names. */
export type ShownMachineMaintenance = Omit<MachineMaintenance, "latestRecords"> & {
  latestRecords: ShownMaintenanceRecord[];
};

/** A maintenance record as the machine record shows it – who recorded it by name. */
export type ShownMaintenanceRecord = Omit<NamedMaintenanceRecord, "recordedBy"> & { recordedBy: string };

/** How many of the latest maintenance records the machine record shows (user, backlog grooming 2026-10-17). */
export const LATEST_MAINTENANCE_RECORDS = 5;

/** How many of the most recently ended entries of the repair history the machine record shows (user, 2026-10-14, `/implement ST-033`). */
export const RECENT_REPAIR_HISTORY_ENTRIES = 3;

/** An entry of the repair history that has ended, as section 7 shows it – who ended it by name. */
export type ShownEndedRepairHistoryEntry = Omit<EndedRepairHistoryEntry, "resolvedBy"> & {
  resolvedBy: string;
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
  const [open, recent, maintenance] = await Promise.all([
    openDefects(db, { machineId: record.id }),
    recentRepairHistory(db, record.id, RECENT_REPAIR_HISTORY_ENTRIES),
    machineMaintenance(db, clock, record.id, { teamMember: viewer, latestRecordCount: LATEST_MAINTENANCE_RECORDS }),
  ]);
  const shown = await named(db, openDefectReferences(open), {
    teamMembers: [
      ...record.statusHistory.map((change) => change.changedBy),
      record.retirement?.retiredBy,
      ...recent.entries.map((entry) => entry.resolvedBy),
      ...maintenance.latestRecords.map((maintenanceRecord) => maintenanceRecord.recordedBy),
    ],
  });
  return {
    ...record,
    statusHistory: record.statusHistory.map((change) => ({ ...change, changedBy: shown.name(change.changedBy) })),
    retirement: record.retirement && { ...record.retirement, retiredBy: shown.name(record.retirement.retiredBy) },
    openDefects: shownOpenDefects(clock, open, shown, viewer),
    recentRepairHistory: recent.entries.map((entry) => ({ ...entry, resolvedBy: shown.name(entry.resolvedBy) })),
    repairHistoryCount: recent.total,
    maintenance: {
      ...maintenance,
      latestRecords: maintenance.latestRecords.map((maintenanceRecord) => ({
        ...maintenanceRecord,
        recordedBy: shown.name(maintenanceRecord.recordedBy),
      })),
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
