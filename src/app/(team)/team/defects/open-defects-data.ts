import { machineIdOf, machineLabels } from "@/modules/collection";
import { openDefects, priorities, type OpenDefect, type Priority } from "@/modules/repair";
import { teamMemberNames } from "@/modules/team";
import type { Clock } from "@/platform/clock";
import type { Database } from "@/platform/command";
import { calendarDate, daysBetween, today } from "@/platform/time";
import { nameOf, shownClaimant, type ShownClaimant, type Viewer } from "../claimant";

/** What the open defects list is narrowed to (ST-021) – all optional, they combine. */
export type OpenDefectsFilter = {
  museumNumber?: string;
  priority?: Priority;
  suitableForHelpers?: boolean;
  /** Only the defects the team member looking at the list has claimed (ST-025). */
  claimedByMe?: boolean;
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
  /** Its claimant, if any (ST-025). */
  claimant: ShownClaimant | undefined;
  /** Who last logged work on it, by name, and when (ST-024) – none while nobody has. */
  lastWorkLogEntry: { loggedBy: string; loggedAt: Date } | undefined;
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
    ...(single(params.mine) === "1" ? { claimedByMe: true } : {}),
  };
}

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * The open defects list's data: Repair's open defects with Collection's museum numbers and titles and Team's names of
 * the claimants – the page composes the modules' public queries (ST-009). How long a defect has been open is computed
 * when the page loads. `viewer` is the team member looking at the list: "claimed by me" means claimed by them.
 */
export async function loadOpenDefects(
  db: Database,
  clock: Clock,
  filter: OpenDefectsFilter,
  viewer?: Viewer,
): Promise<OpenDefectsData> {
  const machineId = filter.museumNumber ? await machineIdOf(db, filter.museumNumber) : undefined;
  const [all, matching] = await Promise.all([
    openDefects(db),
    // An unknown museum number in the address matches no machine – nothing is listed, not everything. The same for
    // "claimed by me" without a team member to mean.
    (filter.museumNumber && !machineId) || (filter.claimedByMe && !viewer)
      ? []
      : openDefects(db, {
          machineId,
          priority: filter.priority,
          suitableForHelpers: filter.suitableForHelpers,
          claimedBy: filter.claimedByMe ? viewer?.id : undefined,
        }),
  ]);
  const [entries, labels] = await Promise.all([
    shownOpenDefects(db, clock, matching, viewer),
    machineLabels(
      db,
      all.map((defect) => defect.machineId),
    ),
  ]);
  return {
    entries,
    total: all.length,
    machines: [...labels.values()].sort((a, b) => a.museumNumber.localeCompare(b.museumNumber)),
    filter,
  };
}

/**
 * Open defects as the team sees them (RM-OpenDefects, ST-021) – with Collection's museum numbers and titles and Team's
 * names, and how long each has been open, computed when the page loads. Shared by the open defects list and the
 * machine record's open defects (ST-033), so both say the same facts in the same words.
 */
export async function shownOpenDefects(
  db: Database,
  clock: Clock,
  defects: OpenDefect[],
  viewer?: Viewer,
): Promise<OpenDefectsItem[]> {
  const [labels, names] = await Promise.all([
    machineLabels(
      db,
      defects.map((defect) => defect.machineId),
    ),
    teamMemberNames(
      db,
      defects.flatMap((defect) => [
        ...(defect.claimedBy ? [defect.claimedBy] : []),
        ...(defect.lastWorkLogEntry ? [defect.lastWorkLogEntry.loggedBy] : []),
      ]),
    ),
  ]);
  const now = today(clock);
  return defects.map((defect) => ({
    id: defect.id,
    museumNumber: labels.get(defect.machineId)?.museumNumber ?? "",
    machineModelTitle: labels.get(defect.machineId)?.machineModelTitle ?? "",
    title: defect.title,
    priority: defect.priority,
    suitableForHelpers: defect.suitableForHelpers,
    openSince: defect.openSince,
    openDays: daysBetween(calendarDate(defect.openSince), now),
    linkedProblemReports: defect.linkedProblemReports,
    claimant: shownClaimant(defect.claimedBy, names, viewer),
    lastWorkLogEntry: defect.lastWorkLogEntry && {
      loggedBy: nameOf(names, defect.lastWorkLogEntry.loggedBy),
      loggedAt: defect.lastWorkLogEntry.loggedAt,
    },
  }));
}
