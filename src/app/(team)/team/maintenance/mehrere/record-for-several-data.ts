import { maintenanceForSeveral, type MaintenanceForSeveral } from "@/modules/maintenance";
import type { Clock } from "@/platform/clock";
import type { Database } from "@/platform/command";
import type { Viewer } from "../../claimant";

/**
 * The selection page „Für mehrere Geräte erfassen“ (ST-045): Maintenance's answer for the task on Collection's
 * machines – which are due, which others it applies to, whether the viewer may record it (G11). Undefined for a
 * maintenance task not in the plan.
 */
export async function loadRecordForSeveral(
  db: Database,
  clock: Clock,
  maintenanceTaskId: string,
  viewer: Viewer,
): Promise<MaintenanceForSeveral | undefined> {
  return maintenanceForSeveral(db, clock, maintenanceTaskId, viewer);
}
