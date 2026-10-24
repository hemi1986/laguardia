import { machinesForMaintenance } from "@/modules/collection";
import { dueMaintenance } from "@/modules/maintenance";
import { changesOnClaimedDefects, openDefects, type ClaimedDefectChange } from "@/modules/repair";
import type { Clock } from "@/platform/clock";
import type { Database } from "@/platform/command";
import { elapsedHours } from "@/platform/time";
import type { Viewer } from "./claimant";
import { openDefectReferences, shownOpenDefects, type OpenDefectsItem } from "./defects/open-defects-data";
import type { DueMaintenanceEntry } from "./maintenance/due-maintenance-data";
import { named, type Named } from "./named";
import { isNew, markLineOf, recentSince } from "./new-since-last-visit";

/**
 * A change on a claimed defect as section 1 says it (ST-086, G25) – who by name, how many hours ago, and whether it is
 * new since the helper's Last visit (ST-050).
 */
export type ShownChange = WithoutTime<ClaimedDefectChange> & { hoursAgo: number; newSinceLastVisit: boolean };

// A change without its point in time, kept apart per kind; its "who" – `by`, `to` – holds names on the page.
type WithoutTime<Change> = Change extends unknown ? Omit<Change, "at"> : never;

/** A defect in section 1 – one the helper claims, or one that left them in the last 7 days (ST-086). */
export type ClaimedByYouItem = {
  id: string;
  title: string;
  museumNumber: string;
  machineModelTitle: string;
  /** What others changed since the helper's claim, newest first (ST-086). */
  changes: ShownChange[];
};

/**
 * What the helper dashboard shows (RM-HelperDashboard, ST-049) – its sections in the order ST-049 fixed (G18).
 */
export type HelperDashboardData = {
  /**
   * Section 1 – the open defects the helper claims right now, in the open defects list's order, then those that left
   * them in the last 7 days, the latest to leave first (user, 2026-10-24, ST-086) – each with what changed on it.
   */
  claimedByYou: ClaimedByYouItem[];
  /**
   * Section 2 – open defects suitable for helpers, without the helper's own claims – they are in section 1 (user,
   * 2026-10-24) –, each marked when it was recorded since the helper's Last visit (ST-050).
   */
  suitableForHelpers: (OpenDefectsItem & { newSinceLastVisit: boolean })[];
  /** Section 3 – each due maintenance task suitable for helpers, on how many machines it is due and overdue (G18, G4a). */
  dueMaintenance: DueMaintenanceEntry[];
};

/**
 * The helper dashboard's data (RM-HelperDashboard): Repair's open defects and what changed on the helper's claimed ones
 * (read from the event journal, ST-086) with Collection's machines and Team's names, and Maintenance's due maintenance
 * tasks on Collection's machines – the page composes (ST-009) –, computed when it is opened (ADR 0002).
 */
export async function loadHelperDashboard(db: Database, clock: Clock, viewer: Viewer): Promise<HelperDashboardData> {
  // A defect that left the helper stays listed for the last 7 days – this dashboard does not reach back further.
  const { since } = recentSince(clock);
  const [marks, claimed, suitable, due, changed] = await Promise.all([
    markLineOf(db, clock, viewer),
    openDefects(db, { claimedBy: viewer.id }),
    openDefects(db, { suitableForHelpers: true }),
    machinesForMaintenance(db).then((machines) => dueMaintenance(db, clock, machines)),
    changesOnClaimedDefects(db, since, viewer.id),
  ]);
  const left = changed
    .flatMap((defect) => (defect.leftAt ? [{ ...defect, leftAt: defect.leftAt }] : []))
    .sort((a, b) => b.leftAt.getTime() - a.leftAt.getTime());
  const suitableForOthers = suitable.filter((defect) => defect.claimedBy !== viewer.id);
  const shownBy = await named(db, openDefectReferences(claimed), openDefectReferences(suitableForOthers), {
    machines: left.map((defect) => defect.machineId),
    teamMembers: changed.flatMap((defect) => defect.changes.flatMap(peopleOf)),
  });
  const claimedItems = shownOpenDefects(clock, claimed, shownBy, viewer);
  const suitableForHelpers = shownOpenDefects(clock, suitableForOthers, shownBy, viewer);
  const now = clock.now();
  const shown = (changes: readonly ClaimedDefectChange[] = []): ShownChange[] =>
    changes.map(({ at, ...change }) => ({
      ...changeWithNames(change, shownBy),
      hoursAgo: elapsedHours(at, now),
      // Never the helper's own – `changesOnClaimedDefects` leaves those out (G25).
      newSinceLastVisit: isNew(marks, at),
    }));
  const changesOf = new Map(changed.map((defect) => [defect.defectId, defect.changes]));
  return {
    claimedByYou: [
      ...claimedItems.map(({ id, title, museumNumber, machineModelTitle }) => ({
        id,
        title,
        museumNumber,
        machineModelTitle,
        changes: shown(changesOf.get(id)),
      })),
      ...left.map((defect) => ({
        id: defect.defectId,
        title: defect.title,
        ...shownBy.label(defect.machineId),
        changes: shown(defect.changes),
      })),
    ],
    // Only technicians record defects – a helper's own is never among them.
    suitableForHelpers: suitableForHelpers.map((defect) => ({
      ...defect,
      newSinceLastVisit: isNew(marks, defect.openSince),
    })),
    dueMaintenance: due
      .filter((task) => task.suitableForHelpers)
      .map((task) => ({
        id: task.id,
        name: task.name,
        machineCount: task.machines.length,
        overdueCount: task.overdueCount,
      })),
  };
}

/** The team members a change names – who did it, and whom a defect was assigned to. */
function peopleOf(change: ClaimedDefectChange): string[] {
  return [...("by" in change ? [change.by] : []), ...("to" in change ? [change.to] : [])];
}

/** A change with its team members by name. */
function changeWithNames(change: WithoutTime<ClaimedDefectChange>, { name }: Named) {
  return {
    ...change,
    ...("by" in change ? { by: name(change.by) } : {}),
    ...("to" in change ? { to: name(change.to) } : {}),
  };
}
