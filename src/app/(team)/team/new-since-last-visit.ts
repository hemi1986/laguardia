import { lastVisitOf } from "@/modules/team";
import type { Clock } from "@/platform/clock";
import type { Database } from "@/platform/command";
import { earlierOf, hoursBefore } from "@/platform/time";
import type { Viewer } from "./claimant";

/** The line a dashboard marks against (ST-050): the viewer's Last visit, from Team's `lastVisitOf`. */
export type MarkLine = { viewer: Viewer; lastVisit: Date };

/** The line a dashboard marks against, for the team member opening it. */
export async function markLineOf(db: Database, clock: Clock, viewer: Viewer): Promise<MarkLine> {
  return { viewer, lastVisit: await lastVisitOf(db, clock, viewer.id) };
}

/**
 * Whether something that happened at `at` – by `by`, when it names who did it – is new since the viewer's Last visit
 * (ST-050, ADR 0011): after the Last visit, and never the viewer's own doing (by actor, not by time).
 */
export function isNew({ viewer, lastVisit }: MarkLine, at: Date, by?: string): boolean {
  return at > lastVisit && by !== viewer.id;
}

/**
 * "The last 7 days" of a dashboard – 168 hours, like "older than 14 days" is 336 (user, 2026-10-24, ST-058) –, the one
 * window both dashboards list changes in (ST-058, ST-086).
 */
const RECENT_HOURS = 168;

/**
 * Where a dashboard's recent changes start: the last 7 days – or, for a dashboard that reaches back to the Last visit
 * (the technician dashboard, ST-050), the Last visit when that is longer ago. `reachedBack` says the Last visit set it.
 */
export function recentSince(clock: Clock, backTo?: MarkLine): { since: Date; reachedBack: boolean } {
  const lastSevenDays = hoursBefore(clock.now(), RECENT_HOURS);
  const since = backTo ? earlierOf(lastSevenDays, backTo.lastVisit) : lastSevenDays;
  return { since, reachedBack: since < lastSevenDays };
}
