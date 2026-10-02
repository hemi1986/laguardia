import { machineRecord, type MachineRecord, type StatusChange } from "@/modules/collection";
import { teamMemberNames } from "@/modules/team";
import type { Database } from "@/platform/command";

/** A status change as the machine record shows it: who changed it by name, not by ID. */
export type NamedStatusChange = Omit<StatusChange, "changedBy"> & { changedBy: string | undefined };

/** The machine record with names – what the page shows (ST-009). */
export type MachineRecordData = Omit<MachineRecord, "statusHistory" | "retirement"> & {
  statusHistory: NamedStatusChange[];
  retirement?: { reason: string; retiredBy: string | undefined; retiredAt: Date };
};

/**
 * The page's data: the Collection module's machine record, with the team members' names from the Team module. The
 * first read across two modules (ST-009): neither module imports the other – the page composes their public queries.
 */
export async function loadMachineRecord(db: Database, museumNumber: string): Promise<MachineRecordData | undefined> {
  const record = await machineRecord(db, museumNumber);
  if (!record) return undefined;
  const ids = [...record.statusHistory.map((change) => change.changedBy), record.retirement?.retiredBy];
  const names = await teamMemberNames(
    db,
    ids.filter((id): id is string => id !== undefined),
  );
  return {
    ...record,
    statusHistory: record.statusHistory.map((change) => ({ ...change, changedBy: names.get(change.changedBy) })),
    retirement: record.retirement && { ...record.retirement, retiredBy: names.get(record.retirement.retiredBy) },
  };
}
