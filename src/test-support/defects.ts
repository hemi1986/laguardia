import { randomUUID } from "node:crypto";
import type { MachineStatus } from "@/modules/collection";
import { reportProblemAndTriageCommand } from "@/modules/repair";
import type { Clock } from "@/platform/clock";
import { executeCommand, type Actor, type Database } from "@/platform/command";
import { aRegisteredMachine } from "./machines";
import { anExistingTeamMember } from "./team-members";

/**
 * An open defect for tests that need one to exist – on a machine of its own, reported and recorded in one step by the
 * given technician (ST-023), through the commands (Q3). The technician is made to exist as an account. Override only
 * what the test is about; a test binds its database, technician and clock once and calls this from there.
 */
export async function anOpenDefectIn(
  db: Database,
  {
    recordedBy,
    at,
    title = "Left flipper weak",
    suitableForHelpers = false,
    machineStatus = "playable",
  }: {
    recordedBy: Extract<Actor, { kind: "team-member" }>;
    at?: Clock;
    title?: string;
    suitableForHelpers?: boolean;
    /** The machine status the machine is registered with. */
    machineStatus?: MachineStatus;
  },
): Promise<{ machineId: string; defectId: string; problemReportId: string }> {
  await anExistingTeamMember(db, recordedBy);
  const machineId = await aRegisteredMachine(db, machineStatus);
  const reported = await executeCommand(
    reportProblemAndTriageCommand,
    {
      machineId,
      description: `${title} – first seen`,
      triage: {
        outcome: "defect-recorded",
        title,
        priority: undefined,
        suitableForHelpers,
        machineStatus: undefined,
        machineVersion: undefined,
      },
    },
    { actor: recordedBy, db, clock: at, newId: randomUUID },
  );
  if (!reported.ok || !reported.result.defectId) throw new Error("no defect recorded");
  return { machineId, defectId: reported.result.defectId, problemReportId: reported.result.problemReportId };
}
