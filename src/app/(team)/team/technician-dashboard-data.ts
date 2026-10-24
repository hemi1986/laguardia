import { machineLabels, machineOverview, type MachineStatus } from "@/modules/collection";
import { openDefectCounts, staleClaims, triageList } from "@/modules/repair";
import { teamMemberNames } from "@/modules/team";
import type { Clock } from "@/platform/clock";
import type { Database } from "@/platform/command";
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

/**
 * What the technician dashboard shows (RM-TechnicianDashboard, ST-048) – its sections in the order ST-048 fixed (G18):
 * 1 problem reports to triage, 2 machines not playable without open defects (ST-048), 3 stale claims (ST-058).
 */
export type TechnicianDashboardData = {
  /** How many problem reports wait for triage, and how many of them longer than 3 days (HS-2). */
  problemReports: { untriaged: number; waitingLong: number };
  /** By museum number. */
  machinesToReturnToPlay: MachineToReturnToPlay[];
  /** The oldest claim first. */
  staleClaims: ShownStaleClaim[];
};

const NOT_PLAYABLE: MachineStatus[] = ["limited", "out-of-order"];

/**
 * The technician dashboard's data (RM-TechnicianDashboard): Repair's triage list and open defects, Collection's machines
 * by machine status – the page composes (ST-009) –, computed when it is opened (ADR 0002). The technician decides
 * whether a machine returns to play (HS-6) – the dashboard only shows which ones could.
 */
export async function loadTechnicianDashboard(db: Database, clock: Clock): Promise<TechnicianDashboardData> {
  const [toTriage, notPlayable, stale] = await Promise.all([
    triageList(db, clock),
    Promise.all(NOT_PLAYABLE.map((machineStatus) => machineOverview(db, { machineStatus }))).then((lists) =>
      lists.flat(),
    ),
    staleClaims(db, clock),
  ]);
  const [openDefects, labels, names] = await Promise.all([
    openDefectCounts(
      db,
      notPlayable.map((machine) => machine.id),
    ),
    machineLabels(
      db,
      stale.map((claim) => claim.machineId),
    ),
    teamMemberNames(
      db,
      stale.map((claim) => claim.claimedBy),
    ),
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
  };
}
