import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { fixedClock } from "@/platform/clock";
import { executeCommand, journalOf } from "@/platform/command";
import { testDatabase } from "@/test-support/database";
import { aRegisteredMachine } from "@/test-support/machines";
import { anExistingTeamMember } from "@/test-support/team-members";
import { recordDefectCommand, reportProblemCommand } from ".";
import { storedProblemReport } from "./problem-report-stand-ins.test-support";

/**
 * Two technicians triage the same problem report at the same time (ST-018, HS-16) – two real transactions on the same
 * problem report version, not a sequence. A third transaction holds the problem report's row until both have loaded
 * version 0 and decided; then it lets go, one commits first, and the other fails the version check – and gets the
 * domain's reason, "already triaged", because the layer decides again on what is stored now (Q11).
 */
const db = testDatabase();
const clock = fixedClock("2026-10-03T20:00:00Z");
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const eva = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;

/** Waits until `count` statements of this database wait for a lock – both technicians are then past their decision. */
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

describe("two technicians and one problem report", () => {
  it("ST-018: Two technicians triage the same problem report", async () => {
    await anExistingTeamMember(db, tom, "Tom");
    await anExistingTeamMember(db, eva, "Eva");
    const machineId = await aRegisteredMachine(db);
    const reported = await executeCommand(
      reportProblemCommand,
      { machineId, description: "Left flipper barely moves" },
      { actor: { kind: "visitor" }, db, clock, newId: randomUUID },
    );
    if (!reported.ok) throw new Error(reported.error);
    const problemReportId = reported.result.problemReportId;

    let letGo!: () => void;
    const holding = db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM problem_report WHERE id = ${problemReportId} FOR UPDATE`);
      await new Promise<void>((resolve) => (letGo = resolve));
    });
    const record = (actor: typeof tom, title: string) =>
      executeCommand(
        recordDefectCommand,
        {
          problemReportId,
          version: 0,
          title,
          priority: undefined,
          suitableForHelpers: false,
          machineStatus: undefined,
          machineVersion: undefined,
        },
        { actor, db, clock, newId: randomUUID },
      );
    const both = Promise.all([record(tom, "Left flipper weak"), record(eva, "Flipper coil weak")]);
    await untilWaitingForLocks(2);
    letGo();
    await holding;
    const outcomes = await both;

    const winner = outcomes[0].ok ? tom : eva;
    expect(outcomes.filter((outcome) => outcome.ok)).toHaveLength(1);
    expect(outcomes.find((outcome) => !outcome.ok)).toEqual({ ok: false, error: "already-triaged" });
    expect((await storedProblemReport(db, problemReportId))?.triage?.triagedBy).toBe(winner.teamMemberId);
    const recorded = (await journalOf(db, { aggregateId: problemReportId })).filter(
      (entry) => entry.type === "EVT-DefectRecorded",
    );
    expect(recorded.map((entry) => entry.actor)).toEqual([winner]);
  });
});
