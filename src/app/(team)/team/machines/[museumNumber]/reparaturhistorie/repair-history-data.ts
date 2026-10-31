import { machineIdOf } from "@/modules/collection";
import {
  repairHistory,
  resolutionsAndReopenings,
  type RepairHistoryEntry,
  type ResolutionOrReopening,
} from "@/modules/repair";
import { photoViewAddresses } from "@/photo";
import { systemClock, type Clock } from "@/platform/clock";
import type { Database } from "@/platform/command";
import { s3Storage } from "@/platform/storage";
import { named } from "../../../named";
import { byYear } from "../history-by-year";
import { photoAt, type PhotoSource } from "../../../team-photos";

/** A team member's ID replaced by their name – „unbekannt“ for an account that is gone (`named`). */
type WithName<Entry, Key extends keyof Entry> = Omit<Entry, Key> & { [K in Key]: string };

type DefectEntry = Extract<RepairHistoryEntry, { kind: "defect" }>;

/** An entry of the repair history as its page shows it – who did what by name. */
export type ShownRepairHistoryEntry =
  | (Omit<DefectEntry, "workLog" | "resolutions" | "reopenings"> & {
      /** Who logged each entry by name, and its photos at their short-lived addresses (ST-032). */
      workLog: (Omit<WithName<DefectEntry["workLog"][number], "loggedBy">, "photos"> & {
        photos: { address: string }[];
      })[];
      /** How it ended each time and why it was reopened, the oldest first (ST-030). */
      resolutionsAndReopenings: (
        | WithName<Extract<ResolutionOrReopening, { kind: "resolution" }>, "resolvedBy">
        | WithName<Extract<ResolutionOrReopening, { kind: "reopening" }>, "reopenedBy">
      )[];
    })
  | WithName<Extract<RepairHistoryEntry, { kind: "resolved-on-the-spot" }>, "resolvedBy">;

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
 * Team's names – the page composes (ST-009). Undefined when there is no machine with that museum number. The photos of
 * the chosen year's work log entries get addresses valid for 5 minutes from `clock` (ST-032).
 */
export async function loadRepairHistory(
  db: Database,
  museumNumber: string,
  chosenYear?: string,
  { clock = systemClock, storage = s3Storage() }: PhotoSource & { clock?: Clock } = {},
): Promise<RepairHistoryData | undefined> {
  // A retired machine keeps its repair history (ST-039).
  const machineId = await machineIdOf(db, museumNumber, { retiredToo: true });
  if (!machineId) return undefined;
  const history = await repairHistory(db, machineId);
  // The year in which an entry began – the defect recorded, the problem reported.
  const years = byYear(history, (entry) => (entry.kind === "defect" ? entry.recordedAt : entry.reportedAt));
  const chosen = years.find(({ year }) => year === chosenYear)?.entries ?? [];
  const year = chosen.length > 0 ? chosenYear : undefined;
  const [photos, shown] = await Promise.all([
    photoViewAddresses(
      storage,
      clock,
      chosen.flatMap((entry) => (entry.kind === "defect" ? entry.workLog.flatMap((logged) => logged.photos) : [])),
    ),
    named(db, {
      machines: [machineId],
      teamMembers: chosen.flatMap((entry) =>
        entry.kind === "defect"
          ? [
              ...entry.workLog.map((logged) => logged.loggedBy),
              ...entry.resolutions.map((ended) => ended.resolvedBy),
              ...entry.reopenings.map((reopened) => reopened.reopenedBy),
            ]
          : [entry.resolvedBy],
      ),
    }),
  ]);
  return {
    machineModelTitle: shown.label(machineId).machineModelTitle,
    years: years.map(({ year: each, entries }) => ({ year: each, count: entries.length })),
    year,
    entries: chosen.map((entry) =>
      entry.kind === "defect"
        ? {
            ...entry,
            workLog: entry.workLog.map((logged) => ({
              ...logged,
              loggedBy: shown.name(logged.loggedBy),
              photos: logged.photos.flatMap((photo) => photoAt(photos, photo) ?? []),
            })),
            resolutionsAndReopenings: resolutionsAndReopenings(entry).map((step) =>
              step.kind === "resolution"
                ? { ...step, resolvedBy: shown.name(step.resolvedBy) }
                : { ...step, reopenedBy: shown.name(step.reopenedBy) },
            ),
          }
        : { ...entry, resolvedBy: shown.name(entry.resolvedBy) },
    ),
  };
}
