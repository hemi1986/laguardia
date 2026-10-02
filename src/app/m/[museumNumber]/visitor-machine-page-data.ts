import { visitorMachine, type VisitorMachine } from "@/modules/collection";
import type { Database } from "@/platform/command";

/** The visitor machine page's data (RM-VisitorMachinePage, ST-010); ST-013 and ST-018 add their counts and titles. */
export type VisitorMachinePageData = VisitorMachine & {
  /** Reporting is offered only for a machine on display (ST-013's rule). */
  reportingPossible: boolean;
};

/**
 * RM-VisitorMachinePage: loaded for every request – never cached (ST-010) –, from the modules' own queries (the page
 * composes, ST-009). Undefined for an unknown museum number.
 */
export async function loadVisitorMachinePage(
  db: Database,
  museumNumber: string,
): Promise<VisitorMachinePageData | undefined> {
  const machine = await visitorMachine(db, museumNumber);
  if (!machine) return undefined;
  return { ...machine, reportingPossible: machine.machineStatus !== "not-on-display" };
}
