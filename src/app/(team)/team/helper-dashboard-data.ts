import { machineLabels, machinesForMaintenance } from "@/modules/collection";
import { dueMaintenance } from "@/modules/maintenance";
import { changesOnClaimedDefects, openDefects, type ClaimedDefectChange } from "@/modules/repair";
import { teamMemberNames } from "@/modules/team";
import type { Clock } from "@/platform/clock";
import type { Database } from "@/platform/command";
import { elapsedHours } from "@/platform/time";
import { nameOf, type Viewer } from "./claimant";
import { shownOpenDefects, type OpenDefectsItem } from "./defects/open-defects-data";
import type { DueMaintenanceEntry } from "./maintenance/due-maintenance-data";

/** A change on a claimed defect as section 1 says it (ST-086, G25) – who by name, and how many hours ago. */
export type ShownChange = DistributiveNamed<ClaimedDefectChange> & { hoursAgo: number };

// Every "who" of a change – `by`, `to` – by name instead of by ID; `at` becomes `hoursAgo`.
type DistributiveNamed<Change> = Change extends unknown ? Omit<Change, "at"> : never;

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
  /** Section 2 – open defects suitable for helpers, without the helper's own claims – they are in section 1 (user, 2026-10-24). */
  suitableForHelpers: OpenDefectsItem[];
  /** Section 3 – each due maintenance task suitable for helpers, on how many machines it is due and overdue (G18, G4a). */
  dueMaintenance: DueMaintenanceEntry[];
};

/**
 * The helper dashboard's data (RM-HelperDashboard): Repair's open defects and what changed on the helper's claimed ones
 * (read from the event journal, ST-086) with Collection's machines and Team's names, and Maintenance's due maintenance
 * tasks on Collection's machines – the page composes (ST-009) –, computed when it is opened (ADR 0002).
 */
export async function loadHelperDashboard(db: Database, clock: Clock, viewer: Viewer): Promise<HelperDashboardData> {
  const [claimed, suitable, due, changed] = await Promise.all([
    openDefects(db, { claimedBy: viewer.id }),
    openDefects(db, { suitableForHelpers: true }),
    machinesForMaintenance(db).then((machines) => dueMaintenance(db, clock, machines)),
    changesOnClaimedDefects(db, clock, viewer.id),
  ]);
  const left = changed
    .flatMap((defect) => (defect.leftAt ? [{ ...defect, leftAt: defect.leftAt }] : []))
    .sort((a, b) => b.leftAt.getTime() - a.leftAt.getTime());
  const [claimedItems, suitableForHelpers, labels, names] = await Promise.all([
    shownOpenDefects(db, clock, claimed, viewer),
    shownOpenDefects(
      db,
      clock,
      suitable.filter((defect) => defect.claimedBy !== viewer.id),
      viewer,
    ),
    machineLabels(
      db,
      left.map((defect) => defect.machineId),
    ),
    teamMemberNames(
      db,
      changed.flatMap((defect) => defect.changes.flatMap(peopleOf)),
    ),
  ]);
  const now = clock.now();
  const shown = (changes: readonly ClaimedDefectChange[] = []): ShownChange[] =>
    changes.map(({ at, ...change }) => ({
      ...named(change, names),
      hoursAgo: elapsedHours(at, now),
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
        // Every defect refers to a machine that exists, retired ones included (foreign key).
        ...labels.get(defect.machineId)!,
        changes: shown(defect.changes),
      })),
    ],
    suitableForHelpers,
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

/** The team members a change names. */
function peopleOf(change: ClaimedDefectChange): string[] {
  return [change.by];
}

/** A change with its team members by name. */
function named(change: DistributiveNamed<ClaimedDefectChange>, names: ReadonlyMap<string, string>) {
  return { ...change, by: nameOf(names, change.by) };
}
