import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { fixedClock } from "@/platform/clock";
import { executeCommand, journalOf } from "@/platform/command";
import { testDatabase } from "@/test-support/database";
import { aRegisteredMachine } from "@/test-support/machines";
import { whileHoldingRow } from "@/test-support/held-row";
import { anExistingTeamMember } from "@/test-support/team-members";
import { recordDefectCommand, reportProblemCommand } from ".";
import { storedProblemReport } from "./command-probes.test-support";

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
    const { both } = await whileHoldingRow(
      db,
      sql`SELECT id FROM problem_report WHERE id = ${problemReportId} FOR UPDATE`,
      async (untilWaiting) => {
        const both = Promise.all([record(tom, "Left flipper weak"), record(eva, "Flipper coil weak")]);
        await untilWaiting(2);
        return { both };
      },
    );
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
