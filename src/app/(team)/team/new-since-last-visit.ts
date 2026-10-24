import type { Viewer } from "./claimant";

/** The line a dashboard marks against (ST-050): the viewer's Last visit, from Team's `lastVisitOf`. */
export type MarkLine = { viewer: Viewer; lastVisit: Date };

/**
 * Whether something that happened at `at` – by `by`, when it names who did it – is new since the viewer's Last visit
 * (ST-050, ADR 0011): after the Last visit, and never the viewer's own doing (by actor, not by time).
 */
export function isNew({ viewer, lastVisit }: MarkLine, at: Date, by?: string): boolean {
  return at > lastVisit && by !== viewer.id;
}
