import {
  machineOverview,
  machineStatusCounts,
  retiredMachineCount,
  type MachineOverviewEntry,
  type MachineOverviewQuery,
  type MachineStatus,
} from "@/modules/collection";
import { openDefectCounts } from "@/modules/repair";
import type { Database } from "@/platform/command";

/**
 * What the page's address narrows the overview to (ST-008, ST-055): a search, a machine status, and the filter
 * „Auch ausgemusterte Geräte anzeigen“. A search finds retired machines with or without it (user, 2026-10-25).
 */
export type OverviewQuery = Omit<MachineOverviewQuery, "retiredToo"> & { retired?: boolean };

/** One machine of the overview as the page shows it – with how many open defects it has (ST-021). */
export type MachineOverviewItem = MachineOverviewEntry & { openDefects: number };

export type MachineOverviewData = {
  machines: MachineOverviewItem[];
  /** Over all active machines – independent of the search and the filter (ST-008). */
  counts: Record<MachineStatus, number>;
  /** How many machines are retired – they can still be found (ST-055). */
  retiredCount: number;
};

/**
 * The machine overview's data: Collection's machines and status counts with Repair's number of open defects per
 * machine – the page composes the modules' public queries (ST-009).
 */
export async function loadMachineOverview(db: Database, query: OverviewQuery): Promise<MachineOverviewData> {
  const { retired, ...narrowed } = query;
  const retiredToo = retired || Boolean(narrowed.search?.trim());
  const [machines, counts, retiredCount] = await Promise.all([
    machineOverview(db, { ...narrowed, retiredToo }),
    machineStatusCounts(db),
    retiredMachineCount(db),
  ]);
  const openDefects = await openDefectCounts(
    db,
    machines.map((machine) => machine.id),
  );
  return {
    machines: machines.map((machine) => ({ ...machine, openDefects: openDefects.get(machine.id) ?? 0 })),
    counts,
    retiredCount,
  };
}
