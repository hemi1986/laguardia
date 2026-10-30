import { machineIdOf } from "@/modules/collection";
import { maintenanceRecords } from "@/modules/maintenance";
import type { Database } from "@/platform/command";
import { teamMessages } from "@/platform/messages";
import { named } from "../../../named";
import { byYear, type HistoryYear } from "../history-by-year";
import type { ShownMaintenanceRecord } from "../machine-record-data";

export type AllMaintenanceRecordsData = {
  title: string;
  machineModelTitle: string;
  /** The years with maintenance records, the newest first, each with its records, the newest first (G24). */
  years: HistoryYear<ShownMaintenanceRecord>[];
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
  const records = await maintenanceRecords(db, { machineId });
  const shownBy = await named(db, { machines: [machineId], teamMembers: records.map((record) => record.recordedBy) });
  const label = shownBy.label(machineId);
  const years = byYear(
    records.map((record) => ({ ...record, recordedBy: shownBy.name(record.recordedBy) })),
    (record) => record.date,
  );
  return {
    title: teamMessages.machineMaintenance.recordsTitle(label.museumNumber),
    machineModelTitle: label.machineModelTitle,
    years,
  };
}
