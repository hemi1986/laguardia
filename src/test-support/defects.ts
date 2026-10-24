import { randomUUID } from "node:crypto";
import { machineForTeamForm, machineLabels, type MachineStatus } from "@/modules/collection";
import {
  defectDetails,
  linkProblemReportToDefectCommand,
  logWorkCommand,
  prioritizeDefectCommand,
  reopenDefectCommand,
  reportProblemAndTriageCommand,
  reportProblemCommand,
  resolveDefectCommand,
  retireMachineCommand,
  type Priority,
} from "@/modules/repair";
import { fixedClock, type Clock } from "@/platform/clock";
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
    priority,
  }: {
    recordedBy: Extract<Actor, { kind: "team-member" }>;
    at?: Clock;
    title?: string;
    suitableForHelpers?: boolean;
    /** The machine status the machine is registered with. */
    machineStatus?: MachineStatus;
    /** The priority it is recorded with – normal, the default, unless a test is about another one. */
    priority?: Priority;
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
        priority,
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

/**
 * A defect whose history a test lays out step by step (ST-051): recorded at `recordedAt` from a problem report reported
 * then, and then – each step at its own instant, through the commands (Q3) – a problem report linked to it, work
 * logged, its priority changed, resolved, reopened, or its machine retired. Each step reads the version it acts on
 * from the defect's page data, as a team member would.
 */
export async function aDefectWithHistory(
  db: Database,
  {
    by,
    recordedAt,
    title = "Left flipper weak",
    priority,
  }: { by: Extract<Actor, { kind: "team-member" }>; recordedAt: string; title?: string; priority?: Priority },
) {
  const { machineId, defectId } = await anOpenDefectIn(db, { recordedBy: by, at: fixedClock(recordedAt), title, priority });
  const at = (instant: string) => ({ actor: by, db, clock: fixedClock(instant), newId: randomUUID });
  const version = async () => {
    const details = await defectDetails(db, defectId);
    if (!details) throw new Error("no defect");
    return details.version;
  };
  const done = async (outcome: Promise<{ ok: true } | { ok: false; error: string }>) => {
    const result = await outcome;
    if (!result.ok) throw new Error(result.error);
  };
  return {
    machineId,
    defectId,
    /** A problem report reported at `reportedAt` by a visitor and linked to the defect at `linkedAt`. */
    async linkedReport(reportedAt: string, linkedAt: string) {
      const reported = await executeCommand(
        reportProblemCommand,
        { machineId, description: `${title} – seen again` },
        { actor: { kind: "visitor" }, db, clock: fixedClock(reportedAt), newId: randomUUID },
      );
      if (!reported.ok) throw new Error(reported.error);
      await done(
        executeCommand(
          linkProblemReportToDefectCommand,
          { problemReportId: reported.result.problemReportId, version: 0, defectId },
          at(linkedAt),
        ),
      );
    },
    async logWork(loggedAt: string) {
      await done(
        executeCommand(
          logWorkCommand,
          { defectId, version: await version(), whatWasDone: "Checked the coil", partsUsed: "" },
          at(loggedAt),
        ),
      );
    },
    async prioritize(newPriority: Priority, prioritizedAt: string) {
      await done(
        executeCommand(
          prioritizeDefectCommand,
          { defectId, version: await version(), priority: newPriority },
          at(prioritizedAt),
        ),
      );
    },
    async resolve(resolvedAt: string) {
      await done(
        executeCommand(resolveDefectCommand, { defectId, version: await version(), closingNote: "Fixed" }, at(resolvedAt)),
      );
    },
    async reopen(reopenedAt: string) {
      await done(
        executeCommand(reopenDefectCommand, { defectId, version: await version(), reason: "It came back" }, at(reopenedAt)),
      );
    },
    /** Its machine retired – which closes the defect on retirement while it is open (ST-039). */
    async retireMachine(retiredAt: string) {
      const label = (await machineLabels(db, [machineId])).get(machineId);
      const machine = label && (await machineForTeamForm(db, label.museumNumber));
      if (!machine) throw new Error("no machine");
      await done(
        executeCommand(retireMachineCommand, { machineId, version: machine.version, reason: "Sold to a collector" }, at(retiredAt)),
      );
    },
  };
}
