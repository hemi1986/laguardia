import { machinesForMaintenance } from "@/modules/collection";
import { maintenanceForSeveral, type MaintenanceForSeveral } from "@/modules/maintenance";
import type { Clock } from "@/platform/clock";
import type { Database } from "@/platform/command";
import type { Viewer } from "../../claimant";

/**
 * The selection page „Für mehrere Geräte erfassen“ (ST-045): Collection's machines and Maintenance's answer for the
 * task on them – which are due, which others it applies to, whether the viewer may record it (G11) – the page composes
 * (ST-009). Undefined for a maintenance task not in the plan.
 */
export async function loadRecordForSeveral(
  db: Database,
  clock: Clock,
  maintenanceTaskId: string,
  viewer: Viewer,
): Promise<MaintenanceForSeveral | undefined> {
  return maintenanceForSeveral(db, clock, maintenanceTaskId, await machinesForMaintenance(db), viewer);
}
