import { machineOverview, type MachineStatus } from "@/modules/collection";
import { openDefectCounts, triageList } from "@/modules/repair";
import type { Clock } from "@/platform/clock";
import type { Database } from "@/platform/command";

/** A machine that could return to play – Limited or Out of order, without open defects (POL-ResolvedDefectsReturnMachineToPlay). */
export type MachineToReturnToPlay = { museumNumber: string; machineModelTitle: string; machineStatus: MachineStatus };

/**
 * What the technician dashboard shows (RM-TechnicianDashboard, ST-048) – its sections in the order ST-048 fixed (G18):
 * 1 problem reports to triage, 2 machines not playable without open defects; 3 to 5 follow with ST-058.
 */
export type TechnicianDashboardData = {
  /** How many problem reports wait for triage, and how many of them longer than 3 days (HS-2). */
  problemReports: { untriaged: number; waitingLong: number };
  /** By museum number. */
  machinesToReturnToPlay: MachineToReturnToPlay[];
};

const NOT_PLAYABLE: MachineStatus[] = ["limited", "out-of-order"];

/**
 * The technician dashboard's data (RM-TechnicianDashboard): Repair's triage list and open defects, Collection's machines
 * by machine status – the page composes (ST-009) –, computed when it is opened (ADR 0002). The technician decides
 * whether a machine returns to play (HS-6) – the dashboard only shows which ones could.
 */
export async function loadTechnicianDashboard(db: Database, clock: Clock): Promise<TechnicianDashboardData> {
  const [toTriage, notPlayable] = await Promise.all([
    triageList(db, clock),
    Promise.all(NOT_PLAYABLE.map((machineStatus) => machineOverview(db, { machineStatus }))).then((lists) =>
      lists.flat(),
    ),
  ]);
  const openDefects = await openDefectCounts(
    db,
    notPlayable.map((machine) => machine.id),
  );
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
  };
}
