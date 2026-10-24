import {
  machineLabels,
  machineOverview,
  machinesForMaintenance,
  statusChangesSince,
  type MachineStatus,
} from "@/modules/collection";
import { dueMaintenance } from "@/modules/maintenance";
import { openDefectCounts, resolvedOrReopenedSince, staleClaims, triageList } from "@/modules/repair";
import { teamMemberNames } from "@/modules/team";
import type { Clock } from "@/platform/clock";
import type { Database } from "@/platform/command";
import { hoursBefore } from "@/platform/time";
import { nameOf } from "./claimant";

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

/** A recent change as section 5 names it – who by name. */
export type RecentChange =
  | {
      kind: "status-change";
      museumNumber: string;
      previousStatus: MachineStatus;
      newStatus: MachineStatus;
      by: string;
      at: Date;
    }
  | { kind: "resolved" | "reopened"; defectId: string; title: string; museumNumber: string; by: string; at: Date };

/**
 * What the technician dashboard shows (RM-TechnicianDashboard, ST-048) – its sections in the order ST-048 fixed (G18):
 * 1 problem reports to triage, 2 machines not playable without open defects (ST-048), 3 stale claims,
 * 4 overdue maintenance tasks, 5 recent changes (ST-058).
 */
export type TechnicianDashboardData = {
  /** How many problem reports wait for triage, and how many of them longer than 3 days (HS-2). */
  problemReports: { untriaged: number; waitingLong: number };
  /** By museum number. */
  machinesToReturnToPlay: MachineToReturnToPlay[];
  /** The oldest claim first. */
  staleClaims: ShownStaleClaim[];
  /** Each overdue maintenance task with how many machines it is overdue on – not the machines (G18). */
  overdueMaintenance: { id: string; name: string; overdueCount: number }[];
  /** Machine status changes and defects resolved or reopened of the last 7 days, newest first – not something that needs attention. */
  recentChanges: RecentChange[];
};

/**
 * "The last 7 days" – 168 hours, like "older than 14 days" is 336 (user, 2026-10-24, ST-058). The last visit (ST-050)
 * may make it longer.
 */
const RECENT_HOURS = 168;

const NOT_PLAYABLE: MachineStatus[] = ["limited", "out-of-order"];

/**
 * The technician dashboard's data (RM-TechnicianDashboard): Repair's triage list and open defects, Collection's machines
 * by machine status – the page composes (ST-009) –, computed when it is opened (ADR 0002). Maintenance's due maintenance tasks on
 * Collection's machines (the rules of ST-043 and ST-056). The technician decides whether a machine returns to play (HS-6) – the dashboard only shows which ones could.
 */
export async function loadTechnicianDashboard(db: Database, clock: Clock): Promise<TechnicianDashboardData> {
  const since = hoursBefore(clock.now(), RECENT_HOURS);
  const [toTriage, notPlayable, stale, due, statusChanges, defectChanges] = await Promise.all([
    triageList(db, clock),
    Promise.all(NOT_PLAYABLE.map((machineStatus) => machineOverview(db, { machineStatus }))).then((lists) =>
      lists.flat(),
    ),
    staleClaims(db, clock),
    machinesForMaintenance(db).then((machines) => dueMaintenance(db, clock, machines)),
    statusChangesSince(db, since),
    resolvedOrReopenedSince(db, since),
  ]);
  const [openDefects, labels, names] = await Promise.all([
    openDefectCounts(
      db,
      notPlayable.map((machine) => machine.id),
    ),
    machineLabels(db, [...stale.map((claim) => claim.machineId), ...defectChanges.map((change) => change.machineId)]),
    teamMemberNames(db, [
      ...stale.map((claim) => claim.claimedBy),
      ...statusChanges.map((change) => change.changedBy),
      ...defectChanges.map((change) => change.by),
    ]),
  ]);
  return {
    problemReports: {
      untriaged: toTriage.length,
      waitingLong: toTriage.filter((report) => report.waitingLong).length,
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
      museumNumber: labels.get(claim.machineId)?.museumNumber ?? "",
      machineModelTitle: labels.get(claim.machineId)?.machineModelTitle ?? "",
      claimant: nameOf(names, claim.claimedBy),
    })),
    overdueMaintenance: due
      .filter((task) => task.overdueCount > 0)
      .map(({ id, name, overdueCount }) => ({ id, name, overdueCount })),
    recentChanges: [
      ...statusChanges.map(({ changedBy, changedAt, ...change }): RecentChange => ({
        kind: "status-change",
        ...change,
        by: nameOf(names, changedBy),
        at: changedAt,
      })),
      ...defectChanges.map(({ machineId, by, ...change }): RecentChange => ({
        ...change,
        museumNumber: labels.get(machineId)?.museumNumber ?? "",
        by: nameOf(names, by),
      })),
    ].sort((a, b) => b.at.getTime() - a.at.getTime()),
  };
}
