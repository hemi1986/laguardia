import { machineIdOf, machineLabels } from "@/modules/collection";
import { openDefects, priorities, type Priority } from "@/modules/repair";
import type { Clock } from "@/platform/clock";
import type { Database } from "@/platform/command";
import { calendarDate, daysBetween, today } from "@/platform/time";

/** What the open defects list is narrowed to (ST-021) – all optional, they combine. */
export type OpenDefectsFilter = {
  museumNumber?: string;
  priority?: Priority;
  suitableForHelpers?: boolean;
};

/** One entry of the open defects list as the page shows it (RM-OpenDefects, ST-021). */
export type OpenDefectsItem = {
  id: string;
  museumNumber: string;
  machineModelTitle: string;
  title: string;
  priority: Priority;
  suitableForHelpers: boolean;
  openSince: Date;
  /** Berlin calendar days since it was recorded – 0 on the day itself. */
  openDays: number;
  /** How many problem reports were linked to it (ST-022). */
  linkedProblemReports: number;
};

/** A machine the filter offers – one with open defects. */
export type MachineToFilterBy = { museumNumber: string; machineModelTitle: string };

export type OpenDefectsData = {
  /** The open defects the filter matches. */
  entries: OpenDefectsItem[];
  /** How many defects are open – all of them, whatever the filter (G6). */
  total: number;
  /** The machines with open defects, by museum number – what the machine filter offers. */
  machines: MachineToFilterBy[];
  filter: OpenDefectsFilter;
};

/** The filter in the address of the list – plain GET parameters, so filtering works without JavaScript. */
export function openDefectsFilterOf(params: Record<string, string | string[] | undefined>): OpenDefectsFilter {
  const museumNumber = single(params.machine)?.trim();
  const priority = priorities.find((candidate) => candidate === single(params.priority));
  return {
    ...(museumNumber ? { museumNumber } : {}),
    ...(priority ? { priority } : {}),
    ...(single(params.helpers) === "1" ? { suitableForHelpers: true } : {}),
  };
}

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * The open defects list's data: Repair's open defects with Collection's museum numbers and titles – the page composes
 * the modules' public queries (ST-009). How long a defect has been open is computed when the page loads.
 */
export async function loadOpenDefects(db: Database, clock: Clock, filter: OpenDefectsFilter): Promise<OpenDefectsData> {
  const machineId = filter.museumNumber ? await machineIdOf(db, filter.museumNumber) : undefined;
  const [all, matching] = await Promise.all([
    openDefects(db),
    // An unknown museum number in the address matches no machine – nothing is listed, not everything.
    filter.museumNumber && !machineId
      ? []
      : openDefects(db, { machineId, priority: filter.priority, suitableForHelpers: filter.suitableForHelpers }),
  ]);
  const labels = await machineLabels(
    db,
    all.map((defect) => defect.machineId),
  );
  const now = today(clock);
  return {
    entries: matching.map((defect) => ({
      id: defect.id,
      museumNumber: labels.get(defect.machineId)?.museumNumber ?? "",
      machineModelTitle: labels.get(defect.machineId)?.machineModelTitle ?? "",
      title: defect.title,
      priority: defect.priority,
      suitableForHelpers: defect.suitableForHelpers,
      openSince: defect.openSince,
      openDays: daysBetween(calendarDate(defect.openSince), now),
      linkedProblemReports: defect.linkedProblemReports,
    })),
    total: all.length,
    machines: [...labels.values()].sort((a, b) => a.museumNumber.localeCompare(b.museumNumber)),
    filter,
  };
}
