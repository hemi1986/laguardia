import { machineOverview, statusChangesSince, type MachineStatus } from "@/modules/collection";
import { dueMaintenance } from "@/modules/maintenance";
import { openDefectCounts, resolvedOrReopenedSince, staleClaims, triageList } from "@/modules/repair";
import type { Clock } from "@/platform/clock";
import type { Database } from "@/platform/command";
import { elapsedHours } from "@/platform/time";
import type { Viewer } from "./claimant";
import { named } from "./named";
import { isNew, markLineOf, recentSince } from "./new-since-last-visit";

/** A machine that could return to play – Limited or Out of order, without open defects (POL-ResolvedDefectsReturnMachineToPlay). */
export type MachineToReturnToPlay = { museumNumber: string; machineModelTitle: string; machineStatus: MachineStatus };

/** A stale claim (CONTEXT.md) as section 3 names it – the defect, its machine and its claimant. */
export type ShownStaleClaim = {
  defectId: string;
  title: string;
  museumNumber: string;
  machineModelTitle: string;
  claimant: string;
};

/**
 * A recent change as section 5 names it – who by name, how many hours ago (ST-092, G25), and whether it is new since
 * the viewer's Last visit (ST-050).
 */
export type RecentChange = (
  | {
      kind: "status-change";
      museumNumber: string;
      previousStatus: MachineStatus;
      newStatus: MachineStatus;
      by: string;
      at: Date;
    }
  | { kind: "resolved" | "reopened"; defectId: string; title: string; museumNumber: string; by: string; at: Date }
) & { hoursAgo: number; newSinceLastVisit: boolean };

/**
 * What the technician dashboard shows (RM-TechnicianDashboard, ST-048) – its sections in the order ST-048 fixed (G18):
 * 1 problem reports to triage, 2 machines not playable without open defects (ST-048), 3 stale claims,
 * 4 overdue maintenance tasks, 5 recent changes (ST-058).
 */
export type TechnicianDashboardData = {
  /**
   * How many problem reports wait for triage, how many of them longer than 3 days (HS-2), and how many of them are new
   * since the viewer's Last visit (ST-050).
   */
  problemReports: { untriaged: number; waitingLong: number; newSinceLastVisit: number };
  /** By museum number. */
  machinesToReturnToPlay: MachineToReturnToPlay[];
  /** The oldest claim first. */
  staleClaims: ShownStaleClaim[];
  /** Each overdue maintenance task with how many machines it is overdue on – not the machines (G18). */
  overdueMaintenance: { id: string; name: string; overdueCount: number }[];
  /**
   * Machine status changes and defects resolved or reopened of the last 7 days – or since the Last visit, if that is
   * longer ago (ST-050) –, newest first; not something that needs attention.
   */
  recentChanges: RecentChange[];
  /** Whether section 5 reaches back to the Last visit rather than 7 days – what its empty text says (ST-050). */
  recentSinceLastVisit: boolean;
};

const NOT_PLAYABLE: MachineStatus[] = ["limited", "out-of-order"];

/**
 * The technician dashboard's data (RM-TechnicianDashboard): Repair's triage list and open defects, Collection's machines
 * by machine status – the page composes (ST-009) –, computed when it is opened (ADR 0002). Maintenance's due maintenance tasks on
 * Collection's machines (the rules of ST-043 and ST-056). The technician decides whether a machine returns to play (HS-6) – the dashboard only shows which ones could.
 */
export async function loadTechnicianDashboard(
  db: Database,
  clock: Clock,
  viewer: Viewer,
): Promise<TechnicianDashboardData> {
  const marks = await markLineOf(db, clock, viewer);
  // Since the Last visit when that is longer ago than the last 7 days (ST-050).
  const { since, reachedBack } = recentSince(clock, marks);
  const [toTriage, notPlayable, stale, due, statusChanges, defectChanges] = await Promise.all([
    triageList(db, clock),
    // Filtered by a machine status, the overview lists active machines only – the narrowing says so to the types.
    Promise.all(NOT_PLAYABLE.map((machineStatus) => machineOverview(db, { machineStatus }))).then((lists) =>
      lists.flat().flatMap((machine) => (machine.retired ? [] : [machine])),
    ),
    staleClaims(db, clock),
    dueMaintenance(db, clock),
    statusChangesSince(db, since),
    resolvedOrReopenedSince(db, since),
  ]);
  const [openDefects, { name, label }] = await Promise.all([
    openDefectCounts(
      db,
      notPlayable.map((machine) => machine.id),
    ),
    named(db, {
      machines: [...stale.map((claim) => claim.machineId), ...defectChanges.map((change) => change.machineId)],
      teamMembers: [
        ...stale.map((claim) => claim.claimedBy),
        ...statusChanges.map((change) => change.changedBy),
        ...defectChanges.map((change) => change.by),
      ],
    }),
  ]);
  return {
    problemReports: {
      untriaged: toTriage.length,
      waitingLong: toTriage.filter((report) => report.waitingLong).length,
      newSinceLastVisit: toTriage.filter((report) =>
        isNew(
          marks,
          report.reportedAt,
          report.reporter.kind === "team-member" ? report.reporter.teamMemberId : undefined,
        ),
      ).length,
    },
    machinesToReturnToPlay: notPlayable
      .filter((machine) => !openDefects.has(machine.id))
      .sort((a, b) => a.museumNumber.localeCompare(b.museumNumber, "de", { numeric: true }))
      .map(({ museumNumber, machineModelTitle, machineStatus }) => ({
        museumNumber,
        machineModelTitle,
        machineStatus,
      })),
    staleClaims: stale.map((claim) => ({
      defectId: claim.defectId,
      title: claim.title,
      ...label(claim.machineId),
      claimant: name(claim.claimedBy),
    })),
    overdueMaintenance: due
      .filter((task) => task.overdueCount > 0)
      .map(({ id, name, overdueCount }) => ({ id, name, overdueCount })),
    recentChanges: [
      ...statusChanges.map(({ changedBy, changedAt, ...change }): RecentChange => ({
        kind: "status-change",
        ...change,
        by: name(changedBy),
        at: changedAt,
        hoursAgo: elapsedHours(changedAt, clock.now()),
        newSinceLastVisit: isNew(marks, changedAt, changedBy),
      })),
      ...defectChanges.map(({ machineId, by, ...change }): RecentChange => ({
        ...change,
        museumNumber: label(machineId).museumNumber,
        by: name(by),
        hoursAgo: elapsedHours(change.at, clock.now()),
        newSinceLastVisit: isNew(marks, change.at, by),
      })),
    ].sort((a, b) => b.at.getTime() - a.at.getTime()),
    recentSinceLastVisit: reachedBack,
  };
}
