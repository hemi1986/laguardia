import { and, count, desc, eq, gte, inArray, isNull, max } from "drizzle-orm";
import { machineForMaintenance } from "@/modules/collection";
import type { Clock } from "@/platform/clock";
import { aggregateStore, isId, type Database, type Latest, type Role } from "@/platform/command";
import { addDays, today, type CalendarDate } from "@/platform/time";
import { MAINTENANCE_PLAN_ID } from "./maintenance-plan";
import { activeMaintenanceTasks, maintenancePlans } from "./maintenance-plans";
import { withMachines } from "./machines-of-maintenance-task";
import {
  LONGEST_BACK_DATING_DAYS,
  recordRefusal,
  type MachineForRecording,
  type MaintenanceFacts,
  type MaintenanceRecord,
  type RecordMaintenanceError,
  type RecordMaintenanceInput,
} from "./record-maintenance";
import { maintenanceRecord, maintenanceTask, maintenanceTaskMachine } from "./schema";

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
 * and the machine as Collection publishes it for maintenance (context map), read in the command's transaction. That read
 * takes the machine's retirement lock shared (ADR 0010) – take no row lock before it.
 */
export async function maintenanceFacts(tx: Database, input: RecordMaintenanceInput): Promise<MaintenanceFacts> {
  const [plan, machine] = await Promise.all([
    maintenancePlans.load(tx, MAINTENANCE_PLAN_ID),
    machineForMaintenance(tx, input.machineId),
  ]);
  return {
    maintenanceTask:
      plan &&
      withMachines(plan.state.maintenanceTasks, plan.state.machinesOfTasks).find(
        (task) => task.id === input.maintenanceTaskId,
      ),
    machine,
  };
}

/** A maintenance record with the name of its maintenance task – as the machine record shows it (ST-047). */
export type NamedMaintenanceRecord = MaintenanceRecord & { maintenanceTaskName: string };

/**
 * The maintenance records of a machine, the newest first – what was done there, by whom (ST-044, ST-047) –, each with
 * its maintenance task's name, a removed task's too. With `limit` only that many of the newest.
 */
export async function maintenanceRecords(
  db: Database,
  { machineId, limit }: { machineId: string; limit?: number },
): Promise<NamedMaintenanceRecord[]> {
  const query = db
    .select({ record: maintenanceRecord, maintenanceTaskName: maintenanceTask.name })
    .from(maintenanceRecord)
    .innerJoin(maintenanceTask, eq(maintenanceRecord.maintenanceTaskId, maintenanceTask.id))
    .where(eq(maintenanceRecord.machineId, machineId))
    .orderBy(desc(maintenanceRecord.date), desc(maintenanceRecord.recordedAt));
  const rows = limit === undefined ? await query : await query.limit(limit);
  return rows.map(({ record, maintenanceTaskName }) => ({ ...toRecord(record), maintenanceTaskName }));
}

/** The newest maintenance records of a machine – at most `limit` – and how many it has in all (the machine record, ST-047). */
export async function latestMaintenanceRecords(
  db: Database,
  machineId: string,
  limit: number,
): Promise<Latest<NamedMaintenanceRecord>> {
  const [latest, [{ total }]] = await Promise.all([
    maintenanceRecords(db, { machineId, limit }),
    db.select({ total: count() }).from(maintenanceRecord).where(eq(maintenanceRecord.machineId, machineId)),
  ]);
  return { latest, total };
}

/**
 * The day each maintenance task was last *done* on each of the given machines – only *done* restarts the interval
 * (ST-044), and only a record recorded since the machine was last added to the task counts (HS-24, ST-094; a record
 * recorded at the very moment of adding counts). Keyed by `lastDoneKey(task, machine)`; a pair without such a record is
 * not in the map.
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
    .innerJoin(
      maintenanceTaskMachine,
      and(
        eq(maintenanceRecord.maintenanceTaskId, maintenanceTaskMachine.maintenanceTaskId),
        eq(maintenanceRecord.machineId, maintenanceTaskMachine.machineId),
        isNull(maintenanceTaskMachine.removedAt),
      ),
    )
    .where(
      and(
        eq(maintenanceRecord.outcome, "done"),
        inArray(maintenanceRecord.machineId, [...machineIds]),
        gte(maintenanceRecord.recordedAt, maintenanceTaskMachine.addedAt),
      ),
    )
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

/**
 * A maintenance task as the form page „Wartung erfassen“ needs it on one machine (ST-044, like `defectForAction`): the
 * task from the plan, why CMD-RecordMaintenance would refuse the team member who asks – none if it would not (G11) –
 * and the dates it accepts: today, preselected, back to the earliest one (D6). The machine is Collection's, as the page
 * passes it (context map). Undefined for a maintenance task not in the plan – removed ones included.
 */
export type MaintenanceForRecording = {
  maintenanceTask: { id: string; name: string; instruction: string };
  whyNot: RecordMaintenanceError | undefined;
  today: CalendarDate;
  earliest: CalendarDate;
};

export async function maintenanceForRecording(
  db: Database,
  clock: Clock,
  maintenanceTaskId: string,
  machine: MachineForRecording,
  teamMember: { role: Role },
): Promise<MaintenanceForRecording | undefined> {
  const task = (await activeMaintenanceTasks(db)).find((candidate) => candidate.id === maintenanceTaskId);
  if (!task) return undefined;
  const now = today(clock);
  return {
    maintenanceTask: { id: task.id, name: task.name, instruction: task.instruction },
    whyNot: recordRefusal(task, machine, teamMember),
    today: now,
    earliest: addDays(now, -LONGEST_BACK_DATING_DAYS),
  };
}
