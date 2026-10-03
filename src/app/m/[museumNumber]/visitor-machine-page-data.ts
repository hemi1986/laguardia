import { machineIdOf, visitorMachine, type VisitorMachine } from "@/modules/collection";
import { openDefectTitles, untriagedProblemReportCount } from "@/modules/repair";
import type { Database } from "@/platform/command";

/** The visitor machine page's data (RM-VisitorMachinePage, ST-010, ST-013, ST-018). */
export type VisitorMachinePageData = VisitorMachine & {
  /** Reporting is offered only for a machine on display (ST-013's rule). */
  reportingPossible: boolean;
  /** How many problem reports wait for triage – the number only, never their texts (HS-1). */
  untriagedProblemReports: number;
  /** The titles of the machine's open defects – written by a technician for visitors, shown untranslated (ST-018). */
  openDefects: string[];
};

/**
 * RM-VisitorMachinePage: loaded for every request – never cached (ST-010) –, from the modules' own queries (the page
 * composes, ST-009). Undefined for an unknown museum number. The machine ID is only used here – nothing internal
 * reaches the public page.
 */
export async function loadVisitorMachinePage(
  db: Database,
  museumNumber: string,
): Promise<VisitorMachinePageData | undefined> {
  const [machine, machineId] = await Promise.all([visitorMachine(db, museumNumber), machineIdOf(db, museumNumber)]);
  if (!machine || !machineId) return undefined;
  return {
    ...machine,
    reportingPossible: machine.machineStatus !== "not-on-display",
    untriagedProblemReports: await untriagedProblemReportCount(db, machineId),
    openDefects: await openDefectTitles(db, machineId),
  };
}
