import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { fixedClock } from "@/platform/clock";
import { executeCommand } from "@/platform/command";
import { testDatabase } from "@/test-support/database";
import { aRegisteredMachine } from "@/test-support/machines";
import { anExistingTeamMember } from "@/test-support/team-members";
import { defectDetails, linkProblemReportToDefectCommand, recordDefectCommand, reportProblemCommand } from ".";
import { resolveDefectForTest, storedProblemReport } from "./problem-report-stand-ins.test-support";

/**
 * A defect resolved while a technician links a problem report to it (ST-022) – two real transactions, not a sequence.
 * A third transaction holds the problem report's row, so the link stops after it has checked the defect and before it
 * commits; the resolution starts then and must wait for the link's lock on the defect instead of slipping in between.
 */
const db = testDatabase();
const clock = fixedClock("2026-10-09T10:00:00Z");
const eva = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;

/** Waits until `count` statements of this database wait for a lock. */
async function untilWaitingForLocks(count: number) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const { rows } = await db.execute<{ waiting: number }>(
      sql`SELECT count(*)::int AS waiting FROM pg_stat_activity
          WHERE datname = current_database() AND wait_event_type = 'Lock'`,
    );
    if (rows[0].waiting >= count) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`never saw ${count} statements waiting for a lock`);
}

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

    let letGo!: () => void;
    const holding = db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM problem_report WHERE id = ${problemReportId} FOR UPDATE`);
      await new Promise<void>((resolve) => (letGo = resolve));
    });
    const linking = executeCommand(
      linkProblemReportToDefectCommand,
      { problemReportId, version: 0, defectId },
      { actor: eva, db, clock, newId: randomUUID },
    );
    await untilWaitingForLocks(1); // the link has checked the defect and waits to save the problem report
    const resolving = executeCommand(
      resolveDefectForTest,
      { defectId, version: 0 },
      { actor: eva, db, clock, newId: randomUUID },
    );
    await untilWaitingForLocks(2); // the resolution waits for the link's lock on the defect
    letGo();
    await holding;

    expect(await linking).toMatchObject({ ok: true });
    expect(await resolving).toMatchObject({ ok: true });
    // The link came first: the problem report refers to the defect, which was then resolved with it.
    expect((await storedProblemReport(db, problemReportId))?.triage).toMatchObject({ outcome: "linked", defectId });
    const details = await defectDetails(db, defectId);
    expect(details?.state).toBe("resolved");
    expect(details?.problemReports.map((report) => report.id)).toContain(problemReportId);
  });
});
