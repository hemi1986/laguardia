import { machineIdOf, statusHistoryOfMachine } from "@/modules/collection";
import type { Database } from "@/platform/command";
import { teamMessages } from "@/platform/messages";
import { calendarDate } from "@/platform/time";
import { named } from "../../../named";
import type { NamedStatusChange } from "../machine-record-data";

export type StatusHistoryData = {
  title: string;
  machineModelTitle: string;
  /** The years with entries, the newest first, each with its entries, the newest first (G24). */
  years: { year: string; changes: NamedStatusChange[] }[];
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
  const years: StatusHistoryData["years"] = [];
  for (const change of history) {
    const year = calendarDate(change.changedAt).slice(0, 4);
    const shown = { ...change, changedBy: shownBy.name(change.changedBy) };
    if (years.at(-1)?.year === year) years.at(-1)!.changes.push(shown);
    else years.push({ year, changes: [shown] });
  }
  return {
    title: teamMessages.statusHistory.title(label.museumNumber),
    machineModelTitle: label.machineModelTitle,
    years,
  };
}
