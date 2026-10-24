import { elapsedMoreThanHours } from "@/platform/time";

/**
 * A team member's dashboard visits as the Team area keeps them (CONTEXT.md: Last visit; ADR 0011): when the current
 * visit began, and the Last visit – the line the dashboard marks everything after as new.
 */
export type StoredVisit = { currentVisitStartedAt: Date; lastVisit: Date };

/** One round on the floor is one visit (ST-050, story review 2026-10-17, decision 2) – the one product constant here. */
const VISIT_HOURS = 1;

/**
 * Opening the dashboard at `now` (ADR 0011): the first visit begins a round and marks nothing; opening it more than one
 * hour after the current visit began begins a new one, whose Last visit is where the previous one began; opening it
 * within that hour belongs to the current visit and changes nothing. Pure – the recorder stores the result when it
 * `changed`, the dashboards only read its `lastVisit`.
 */
export function decideVisit(stored: StoredVisit | undefined, now: Date): { visit: StoredVisit; changed: boolean } {
  if (!stored) return { visit: { currentVisitStartedAt: now, lastVisit: now }, changed: true };
  if (!elapsedMoreThanHours(stored.currentVisitStartedAt, now, VISIT_HOURS)) return { visit: stored, changed: false };
  return { visit: { currentVisitStartedAt: now, lastVisit: stored.currentVisitStartedAt }, changed: true };
}
