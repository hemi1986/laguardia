import { openDefects } from "@/modules/repair";
import type { Clock } from "@/platform/clock";
import type { Database } from "@/platform/command";
import type { Viewer } from "./claimant";
import { shownOpenDefects, type OpenDefectsItem } from "./defects/open-defects-data";

/**
 * What the helper dashboard shows (RM-HelperDashboard, ST-049) – its sections in the order ST-049 fixed (G18).
 */
export type HelperDashboardData = {
  /** Section 2 – open defects suitable for helpers, as the open defects list says them. */
  suitableForHelpers: OpenDefectsItem[];
};

/**
 * The helper dashboard's data (RM-HelperDashboard): Repair's open defects with Collection's machines – the page composes
 * (ST-009) –, computed when it is opened from the current state (ADR 0002); no journal read before ST-086.
 */
export async function loadHelperDashboard(db: Database, clock: Clock, viewer: Viewer): Promise<HelperDashboardData> {
  const suitable = await openDefects(db, { suitableForHelpers: true });
  return { suitableForHelpers: await shownOpenDefects(db, clock, suitable, viewer) };
}
