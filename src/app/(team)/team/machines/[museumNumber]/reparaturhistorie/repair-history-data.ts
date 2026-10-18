import { machineIdOf, machineLabels } from "@/modules/collection";
import {
  repairHistory,
  resolutionsAndReopenings,
  type RepairHistoryEntry,
  type ResolutionOrReopening,
} from "@/modules/repair";
import { teamMemberNames } from "@/modules/team";
import type { Database } from "@/platform/command";
import { calendarDate } from "@/platform/time";

/** A team member's ID replaced by their name – undefined for an account that is gone. */
type Named<Entry, Key extends keyof Entry> = Omit<Entry, Key> & { [K in Key]: string | undefined };

type DefectEntry = Extract<RepairHistoryEntry, { kind: "defect" }>;

/** An entry of the repair history as its page shows it – who did what by name. */
export type ShownRepairHistoryEntry =
  | (Omit<DefectEntry, "workLog" | "resolutions" | "reopenings"> & {
      workLog: Named<DefectEntry["workLog"][number], "loggedBy">[];
      /** How it ended each time and why it was reopened, the oldest first (ST-030). */
      resolutionsAndReopenings: (
        | Named<Extract<ResolutionOrReopening, { kind: "resolution" }>, "resolvedBy">
        | Named<Extract<ResolutionOrReopening, { kind: "reopening" }>, "reopenedBy">
      )[];
    })
  | Named<Extract<RepairHistoryEntry, { kind: "resolved-on-the-spot" }>, "resolvedBy">;

export type RepairHistoryData = {
  machineModelTitle: string;
  /** The years with entries, the newest first, each with how many it has (G4a). */
  years: { year: string; count: number }[];
  /** The year chosen – only one that has entries; none until one is chosen. */
  year: string | undefined;
  /** The entries of the chosen year, the newest first – none until a year is chosen. */
  entries: ShownRepairHistoryEntry[];
};

/**
 * The repair history's own page (ST-033, user 2026-10-14): Repair's repair history of the machine, grouped by the
 * Berlin calendar year in which each defect was recorded or problem reported, with Collection's machine model title and
 * Team's names – the page composes (ST-009). Undefined when there is no machine with that museum number.
 */
export async function loadRepairHistory(
  db: Database,
  museumNumber: string,
  chosenYear?: string,
): Promise<RepairHistoryData | undefined> {
  const machineId = await machineIdOf(db, museumNumber);
  if (!machineId) return undefined;
  const [labels, history] = await Promise.all([machineLabels(db, [machineId]), repairHistory(db, machineId)]);
  const counts = new Map<string, number>();
  for (const entry of history) counts.set(yearOf(entry), (counts.get(yearOf(entry)) ?? 0) + 1);
  const year = chosenYear && counts.has(chosenYear) ? chosenYear : undefined;
  const chosen = year ? history.filter((entry) => yearOf(entry) === year) : [];
  const names = await teamMemberNames(
    db,
    chosen.flatMap((entry) =>
      entry.kind === "defect"
        ? [
            ...entry.workLog.map((logged) => logged.loggedBy),
            ...entry.resolutions.map((ended) => ended.resolvedBy),
            ...entry.reopenings.map((reopened) => reopened.reopenedBy),
          ]
        : [entry.resolvedBy],
    ),
  );
  return {
    machineModelTitle: labels.get(machineId)?.machineModelTitle ?? "",
    // The years are written alike, so their order as text is their order in time.
    years: [...counts].map(([year, count]) => ({ year, count })).sort((a, b) => b.year.localeCompare(a.year)),
    year,
    entries: chosen.map((entry) =>
      entry.kind === "defect"
        ? {
            ...entry,
            workLog: entry.workLog.map((logged) => ({ ...logged, loggedBy: names.get(logged.loggedBy) })),
            resolutionsAndReopenings: resolutionsAndReopenings(entry).map((step) =>
              step.kind === "resolution"
                ? { ...step, resolvedBy: names.get(step.resolvedBy) }
                : { ...step, reopenedBy: names.get(step.reopenedBy) },
            ),
          }
        : { ...entry, resolvedBy: names.get(entry.resolvedBy) },
    ),
  };
}

/** The Berlin calendar year in which an entry began – the defect recorded, the problem reported. */
function yearOf(entry: RepairHistoryEntry): string {
  return calendarDate(entry.kind === "defect" ? entry.recordedAt : entry.reportedAt).slice(0, 4);
}
