import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { fixedClock } from "@/platform/clock";
import { executeCommand } from "@/platform/command";
import { testDatabase } from "@/test-support/database";
import { aRegisteredMachine } from "@/test-support/machines";
import { whileHoldingRow } from "@/test-support/held-row";
import { anExistingTeamMember } from "@/test-support/team-members";
import {
  defectDetails,
  linkProblemReportToDefectCommand,
  recordDefectCommand,
  reportProblemCommand,
  resolveDefectCommand,
} from ".";
import { storedProblemReport } from "./problem-report-stand-ins.test-support";

/**
 * A defect resolved while a technician links a problem report to it (ST-022) – two real transactions, not a sequence.
 * A third transaction holds the problem report's row, so the link stops after it has checked the defect and before it
 * commits; the resolution starts then and must wait for the link's lock on the defect instead of slipping in between.
 */
const db = testDatabase();
const clock = fixedClock("2026-10-09T10:00:00Z");
const eva = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;

async function reported(machineId: string, description: string) {
  const outcome = await executeCommand(
    reportProblemCommand,
    { machineId, description },
    { actor: { kind: "visitor" }, db, clock, newId: randomUUID },
  );
  if (!outcome.ok) throw new Error(outcome.error);
  return outcome.result.problemReportId;
}

describe("linking while the defect is resolved", () => {
  it("a resolution waits for the link that checked the defect open", async () => {
    await anExistingTeamMember(db, eva, "Eva");
    const machineId = await aRegisteredMachine(db);
    const recorded = await executeCommand(
      recordDefectCommand,
      {
        problemReportId: await reported(machineId, "Left flipper barely moves"),
        version: 0,
        title: "Left flipper weak",
        priority: undefined,
        suitableForHelpers: false,
        machineStatus: undefined,
        machineVersion: undefined,
      },
      { actor: eva, db, clock, newId: randomUUID },
    );
    if (!recorded.ok) throw new Error(recorded.error);
    const defectId = recorded.result.defectId;
    const problemReportId = await reported(machineId, "Flipper on the left does nothing");

    const { linking, resolving } = await whileHoldingRow(
      db,
      sql`SELECT id FROM problem_report WHERE id = ${problemReportId} FOR UPDATE`,
      async (untilWaiting) => {
        const linking = executeCommand(
          linkProblemReportToDefectCommand,
          { problemReportId, version: 0, defectId },
          { actor: eva, db, clock, newId: randomUUID },
        );
        await untilWaiting(1); // the link has checked the defect and waits to save the problem report
        const resolving = executeCommand(
          resolveDefectCommand,
          { defectId, version: 0, closingNote: "Fixed" },
          { actor: eva, db, clock, newId: randomUUID },
        );
        await untilWaiting(2); // the resolution waits for the link's lock on the defect
        return { linking, resolving };
      },
    );

    expect(await linking).toMatchObject({ ok: true });
    expect(await resolving).toMatchObject({ ok: true });
    // The link came first: the problem report refers to the defect, which was then resolved with it.
    expect((await storedProblemReport(db, problemReportId))?.triage).toMatchObject({ outcome: "linked", defectId });
    const details = await defectDetails(db, defectId);
    expect(details?.state).toBe("resolved");
    expect(details?.problemReports.map((report) => report.id)).toContain(problemReportId);
  });
});
