import { machineIdOf } from "@/modules/collection";
import { openDefects, priorities, type HoldReason, type OpenDefect, type Priority } from "@/modules/repair";
import type { Clock } from "@/platform/clock";
import type { Database } from "@/platform/command";
import { calendarDate, daysBetween, today } from "@/platform/time";
import { shownClaimant, type ShownClaimant, type Viewer } from "../claimant";
import { named, type Named, type References } from "../named";

/** What the open defects list is narrowed to (ST-021) – all optional, they combine. */
export type OpenDefectsFilter = {
  museumNumber?: string;
  priority?: Priority;
  suitableForHelpers?: boolean;
  /** Only the defects the team member looking at the list has claimed (ST-025). */
  claimedByMe?: boolean;
  /** Only the defects on hold (ST-029). */
  onHold?: boolean;
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
  /** Why it waits, if it is on hold (ST-029). */
  holdReason: HoldReason | undefined;
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
    ...(single(params.held) === "1" ? { onHold: true } : {}),
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
          onHold: filter.onHold,
        }),
  ]);
  const shown = await named(db, openDefectReferences(matching), { machines: all.map((defect) => defect.machineId) });
  return {
    entries: shownOpenDefects(clock, matching, shown, viewer),
    total: all.length,
    machines: [...new Set(all.map((defect) => defect.machineId))]
      .map(shown.label)
      .sort((a, b) => a.museumNumber.localeCompare(b.museumNumber)),
    filter,
  };
}

/** The team members and machines open defects refer to – for the page's `named`. */
export function openDefectReferences(defects: readonly OpenDefect[]): References {
  return {
    machines: defects.map((defect) => defect.machineId),
    teamMembers: defects.flatMap((defect) => [defect.claimedBy, defect.lastWorkLogEntry?.loggedBy]),
  };
}

/**
 * Open defects as the team sees them (RM-OpenDefects, ST-021) – with Collection's museum numbers and titles and Team's
 * names (`named`, over at least `openDefectReferences(defects)`), and how long each has been open, computed when the
 * page loads. Shared by the open defects list, the machine record's open defects (ST-033) and the helper dashboard, so
 * all say the same facts in the same words.
 */
export function shownOpenDefects(
  clock: Clock,
  defects: readonly OpenDefect[],
  shown: Named,
  viewer?: Viewer,
): OpenDefectsItem[] {
  const now = today(clock);
  return defects.map((defect) => ({
    id: defect.id,
    ...shown.label(defect.machineId),
    title: defect.title,
    priority: defect.priority,
    suitableForHelpers: defect.suitableForHelpers,
    openSince: defect.openSince,
    openDays: daysBetween(calendarDate(defect.openSince), now),
    linkedProblemReports: defect.linkedProblemReports,
    claimant: shownClaimant(defect.claimedBy, shown, viewer),
    lastWorkLogEntry: defect.lastWorkLogEntry && {
      loggedBy: shown.name(defect.lastWorkLogEntry.loggedBy),
      loggedAt: defect.lastWorkLogEntry.loggedAt,
    },
    holdReason: defect.hold?.reason,
  }));
}
