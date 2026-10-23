import { entriesOf, lastCommandBy, type Database, type JournalEntry, type TeamMemberId } from "@/platform/command";
import type { MaintenancePlanChange } from "./change-maintenance-plan";
import { maintenanceEvents } from "./events";
import { MAINTENANCE_PLAN_ID } from "./maintenance-plan";

/**
 * Whether one command recorded this maintenance record – asked of the events `lastCommandBy` returns, for a page's
 * confirmation (G3, architecture review 2026-10-18).
 */
export function maintenanceRecordedIn(command: readonly JournalEntry[], maintenanceRecordId: string): boolean {
  return entriesOf(maintenanceEvents, command).some(
    (entry) => entry.type === "EVT-MaintenanceRecorded" && entry.aggregate.id === maintenanceRecordId,
  );
}

/**
 * Whether the latest change of the maintenance plan made this change to this maintenance task and the given team member
 * made it (ST-040, ST-041) – the maintenance plan is one aggregate, so Maintenance names it here.
 */
export async function maintenancePlanChangeBy(
  db: Database,
  { maintenanceTaskId, change }: { maintenanceTaskId: string; change: MaintenancePlanChange },
  teamMemberId: TeamMemberId,
): Promise<boolean> {
  const command = await lastCommandBy(db, { aggregateId: MAINTENANCE_PLAN_ID }, teamMemberId);
  return (command ? entriesOf(maintenanceEvents, command) : []).some(
    (entry) =>
      entry.type === "EVT-MaintenancePlanChanged" &&
      entry.data.maintenanceTaskId === maintenanceTaskId &&
      entry.data.change === change,
  );
}
