import { and, desc, eq, inArray, max } from "drizzle-orm";
import { machineForMaintenance } from "@/modules/collection";
import { aggregateStore, isId, type Database } from "@/platform/command";
import type { CalendarDate } from "@/platform/time";
import { MAINTENANCE_PLAN_ID } from "./maintenance-plan";
import { maintenancePlans } from "./maintenance-plans";
import type { MaintenanceFacts, MaintenanceRecord, RecordMaintenanceInput } from "./record-maintenance";
import { maintenanceRecord } from "./schema";

function toRecord(row: typeof maintenanceRecord.$inferSelect): MaintenanceRecord {
  return {
    id: row.id,
    machineId: row.machineId,
    maintenanceTaskId: row.maintenanceTaskId,
    outcome: row.outcome,
    date: row.date,
    note: row.note ?? undefined,
    recordedBy: row.recordedBy,
    recordedAt: row.recordedAt,
  };
}

/** How AGG-MaintenanceRecord is stored (ST-044): one row per record, created once and never changed. */
export const maintenanceRecordStore = aggregateStore({
  type: "AGG-MaintenanceRecord",
  table: maintenanceRecord,
  toState: toRecord,
  toRow: (record: MaintenanceRecord) => ({ ...record, note: record.note ?? null }),
});

/**
 * The facts of CMD-RecordMaintenance: the maintenance task from the plan – removed ones too, the decision says so –
 * and the machine as Collection publishes it for maintenance (context map), read in the command's transaction without
 * a lock.
 */
export async function maintenanceFacts(tx: Database, input: RecordMaintenanceInput): Promise<MaintenanceFacts> {
  const [plan, machine] = await Promise.all([
    maintenancePlans.load(tx, MAINTENANCE_PLAN_ID),
    machineForMaintenance(tx, input.machineId),
  ]);
  return {
    maintenanceTask: plan?.state.maintenanceTasks.find((task) => task.id === input.maintenanceTaskId),
    machine,
  };
}

/** The maintenance records of a machine, the newest first – what was done there, by whom (ST-044, ST-047). */
export async function maintenanceRecords(
  db: Database,
  { machineId }: { machineId: string },
): Promise<MaintenanceRecord[]> {
  const rows = await db
    .select()
    .from(maintenanceRecord)
    .where(eq(maintenanceRecord.machineId, machineId))
    .orderBy(desc(maintenanceRecord.date), desc(maintenanceRecord.recordedAt));
  return rows.map(toRecord);
}

/**
 * The day each maintenance task was last *done* on each of the given machines – only *done* restarts the interval
 * (ST-044). Keyed by `lastDoneKey(task, machine)`; a pair without a record *done* is not in the map.
 */
export async function lastDoneByRecord(
  db: Database,
  machineIds: readonly string[],
): Promise<Map<string, CalendarDate>> {
  if (machineIds.length === 0) return new Map();
  const rows = await db
    .select({
      maintenanceTaskId: maintenanceRecord.maintenanceTaskId,
      machineId: maintenanceRecord.machineId,
      date: max(maintenanceRecord.date),
    })
    .from(maintenanceRecord)
    .where(and(eq(maintenanceRecord.outcome, "done"), inArray(maintenanceRecord.machineId, [...machineIds])))
    .groupBy(maintenanceRecord.maintenanceTaskId, maintenanceRecord.machineId);
  return new Map(
    rows.flatMap((row) => (row.date ? [[lastDoneKey(row.maintenanceTaskId, row.machineId), row.date] as const] : [])),
  );
}

export function lastDoneKey(maintenanceTaskId: string, machineId: string): string {
  return `${maintenanceTaskId}/${machineId}`;
}

/** One maintenance record by its ID – for the confirmation after recording it (G3). Undefined for an unknown ID. */
export async function maintenanceRecordById(
  db: Database,
  maintenanceRecordId: string,
): Promise<MaintenanceRecord | undefined> {
  if (!isId(maintenanceRecordId)) return undefined;
  const [row] = await db.select().from(maintenanceRecord).where(eq(maintenanceRecord.id, maintenanceRecordId));
  return row && toRecord(row);
}
