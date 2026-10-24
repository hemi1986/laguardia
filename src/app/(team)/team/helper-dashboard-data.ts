import { machinesForMaintenance } from "@/modules/collection";
import { dueMaintenance } from "@/modules/maintenance";
import { openDefects } from "@/modules/repair";
import type { Clock } from "@/platform/clock";
import type { Database } from "@/platform/command";
import type { Viewer } from "./claimant";
import { shownOpenDefects, type OpenDefectsItem } from "./defects/open-defects-data";
import type { DueMaintenanceEntry } from "./maintenance/due-maintenance-data";

/**
 * What the helper dashboard shows (RM-HelperDashboard, ST-049) – its sections in the order ST-049 fixed (G18).
 */
export type HelperDashboardData = {
  /** Section 1 – the open defects the helper claims right now, as the open defects list says them. */
  claimedByYou: OpenDefectsItem[];
  /** Section 2 – open defects suitable for helpers, without the helper's own claims – they are in section 1 (user, 2026-10-24). */
  suitableForHelpers: OpenDefectsItem[];
  /** Section 3 – each due maintenance task suitable for helpers, on how many machines it is due and overdue (G18, G4a). */
  dueMaintenance: DueMaintenanceEntry[];
};

/**
 * The helper dashboard's data (RM-HelperDashboard): Repair's open defects with Collection's machines, and Maintenance's due
 * maintenance tasks on Collection's machines – the page composes (ST-009) –, computed when it is opened from the current state (ADR 0002); no journal read before ST-086.
 */
export async function loadHelperDashboard(db: Database, clock: Clock, viewer: Viewer): Promise<HelperDashboardData> {
  const [claimed, suitable, due] = await Promise.all([
    openDefects(db, { claimedBy: viewer.id }),
    openDefects(db, { suitableForHelpers: true }),
    machinesForMaintenance(db).then((machines) => dueMaintenance(db, clock, machines)),
  ]);
  const [claimedByYou, suitableForHelpers] = await Promise.all([
    shownOpenDefects(db, clock, claimed, viewer),
    shownOpenDefects(
      db,
      clock,
      suitable.filter((defect) => defect.claimedBy !== viewer.id),
      viewer,
    ),
  ]);
  return {
    claimedByYou,
    suitableForHelpers,
    dueMaintenance: due
      .filter((task) => task.suitableForHelpers)
      .map((task) => ({
        id: task.id,
        name: task.name,
        machineCount: task.machines.length,
        overdueCount: task.overdueCount,
      })),
  };
}
