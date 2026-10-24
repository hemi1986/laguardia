import { repairTimePeriods, repairTimes, type RepairTimePeriod, type RepairTimesOfPriority } from "@/modules/repair";
import type { Clock } from "@/platform/clock";
import type { Database } from "@/platform/command";

export type RepairTimesData = { period: RepairTimePeriod; priorities: RepairTimesOfPriority[] };

/**
 * The repair times' data (ST-051): RM-RepairTimes for the period the address names – `?zeitraum=90` for the last 90
 * days; anything else is the preselected last 30 days (G20).
 */
export async function loadRepairTimes(
  db: Database,
  clock: Clock,
  params: Record<string, string | string[] | undefined>,
): Promise<RepairTimesData> {
  const period = repairTimePeriods.find((days) => String(days) === params.zeitraum) ?? 30;
  return { period, priorities: await repairTimes(db, clock, period) };
}
