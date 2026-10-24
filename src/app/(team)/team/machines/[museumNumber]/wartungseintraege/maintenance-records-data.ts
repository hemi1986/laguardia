import { machineIdOf, machineLabels } from "@/modules/collection";
import { maintenanceRecords } from "@/modules/maintenance";
import { teamMemberNames } from "@/modules/team";
import type { Database } from "@/platform/command";
import { teamMessages } from "@/platform/messages";
import type { ShownMaintenanceRecord } from "../machine-record-data";

export type AllMaintenanceRecordsData = {
  title: string;
  machineModelTitle: string;
  /** The years with maintenance records, the newest first, each with its records, the newest first (G4a). */
  years: { year: string; records: ShownMaintenanceRecord[] }[];
};

/**
 * The page „Wartungseinträge · LG-042“ (ST-047): every maintenance record of the machine – Maintenance's –, with
 * Collection's machine model title and Team's names (the page composes, ST-009), grouped by the year it was carried
 * out. Undefined when there is no machine with that museum number.
 */
export async function loadAllMaintenanceRecords(
  db: Database,
  museumNumber: string,
): Promise<AllMaintenanceRecordsData | undefined> {
  // A retired machine keeps its maintenance records.
  const machineId = await machineIdOf(db, museumNumber, { retiredToo: true });
  if (!machineId) return undefined;
  const [labels, records] = await Promise.all([machineLabels(db, [machineId]), maintenanceRecords(db, { machineId })]);
  const label = labels.get(machineId);
  if (!label) return undefined;
  const names = await teamMemberNames(db, [...new Set(records.map((record) => record.recordedBy))]);
  const years: AllMaintenanceRecordsData["years"] = [];
  for (const record of records) {
    const year = record.date.slice(0, 4);
    const shown = { ...record, recordedBy: names.get(record.recordedBy) };
    if (years.at(-1)?.year === year) years.at(-1)!.records.push(shown);
    else years.push({ year, records: [shown] });
  }
  return {
    title: teamMessages.machineMaintenance.recordsTitle(label.museumNumber),
    machineModelTitle: label.machineModelTitle,
    years,
  };
}
