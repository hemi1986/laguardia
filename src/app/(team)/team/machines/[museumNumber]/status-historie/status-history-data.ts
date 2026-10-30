import { machineIdOf, statusHistoryOfMachine } from "@/modules/collection";
import type { Database } from "@/platform/command";
import { teamMessages } from "@/platform/messages";
import { named } from "../../../named";
import { byYear, type HistoryYear } from "../history-by-year";
import type { NamedStatusChange } from "../machine-record-data";

export type StatusHistoryData = {
  title: string;
  machineModelTitle: string;
  /** The years with entries, the newest first, each with its entries, the newest first (G24). */
  years: HistoryYear<NamedStatusChange>[];
};

/**
 * The page „Status-Historie · LG-042“ (ST-093): every entry of the machine's status history – Collection's –, with its
 * machine model title and Team's names (the page composes, ST-009), grouped by the Berlin calendar year of the entry.
 * Undefined when there is no machine with that museum number.
 */
export async function loadStatusHistory(db: Database, museumNumber: string): Promise<StatusHistoryData | undefined> {
  // A retired machine keeps its status history (ST-039).
  const machineId = await machineIdOf(db, museumNumber, { retiredToo: true });
  if (!machineId) return undefined;
  const history = await statusHistoryOfMachine(db, machineId);
  const shownBy = await named(db, { machines: [machineId], teamMembers: history.map((change) => change.changedBy) });
  const label = shownBy.label(machineId);
  const years = byYear(
    history.map((change) => ({ ...change, changedBy: shownBy.name(change.changedBy) })),
    (change) => change.changedAt,
  );
  return {
    title: teamMessages.statusHistory.title(label.museumNumber),
    machineModelTitle: label.machineModelTitle,
    years,
  };
}
