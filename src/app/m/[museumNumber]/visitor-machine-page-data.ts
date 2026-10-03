import { visitorMachine, type VisitorMachine } from "@/modules/collection";
import { untriagedProblemReportCount } from "@/modules/repair";
import type { Database } from "@/platform/command";

/** The visitor machine page's data (RM-VisitorMachinePage, ST-010, ST-013); ST-018 adds the open defects' titles. */
export type VisitorMachinePageData = Omit<VisitorMachine, "machineId"> & {
  /** Reporting is offered only for a machine on display (ST-013's rule). */
  reportingPossible: boolean;
  /** How many problem reports wait for triage – the number only, never their texts (HS-1). */
  untriagedProblemReports: number;
};

/**
 * RM-VisitorMachinePage: loaded for every request – never cached (ST-010) –, from the modules' own queries (the page
 * composes, ST-009). Undefined for an unknown museum number. The machine ID stays here – nothing internal reaches the
 * public page.
 */
export async function loadVisitorMachinePage(
  db: Database,
  museumNumber: string,
): Promise<VisitorMachinePageData | undefined> {
  const machine = await visitorMachine(db, museumNumber);
  if (!machine) return undefined;
  const { machineId, ...visible } = machine;
  return {
    ...visible,
    reportingPossible: machine.machineStatus !== "not-on-display",
    untriagedProblemReports: await untriagedProblemReportCount(db, machineId),
  };
}
