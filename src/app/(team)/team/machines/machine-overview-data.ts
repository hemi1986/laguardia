import {
  machineOverview,
  machineStatusCounts,
  type MachineOverviewEntry,
  type MachineOverviewQuery,
  type MachineStatus,
} from "@/modules/collection";
import { openDefectCounts } from "@/modules/repair";
import type { Database } from "@/platform/command";

/** One machine of the overview as the page shows it – with how many open defects it has (ST-021). */
export type MachineOverviewItem = MachineOverviewEntry & { openDefects: number };

export type MachineOverviewData = {
  machines: MachineOverviewItem[];
  /** Over all active machines – independent of the search and the filter (ST-008). */
  counts: Record<MachineStatus, number>;
};

/**
 * The machine overview's data: Collection's machines and status counts with Repair's number of open defects per
 * machine – the page composes the modules' public queries (ST-009).
 */
export async function loadMachineOverview(db: Database, query: MachineOverviewQuery): Promise<MachineOverviewData> {
  const [machines, counts] = await Promise.all([machineOverview(db, query), machineStatusCounts(db)]);
  const openDefects = await openDefectCounts(
    db,
    machines.map((machine) => machine.id),
  );
  return {
    machines: machines.map((machine) => ({ ...machine, openDefects: openDefects.get(machine.id) ?? 0 })),
    counts,
  };
}
