import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { fixedClock } from "@/platform/clock";
import { executeCommand, journalOf } from "@/platform/command";
import { commandErrorText, teamMessages } from "@/platform/messages";
import { testDatabase } from "@/test-support/database";
import { aRegisteredMachine } from "@/test-support/machines";
import { anExistingTeamMember } from "@/test-support/team-members";
import { claimDefectCommand, reportProblemAndTriageCommand } from ".";
import { storedDefect } from "./problem-report-stand-ins.test-support";

/**
 * Two team members claim the same defect at the same time (ST-025, ST-003) – two real transactions on the same version
 * of the defect, not a sequence. A third transaction holds the defect's row until both have loaded version 0 and
 * decided; Tom's save waits for it first, Eva's second. When it lets go, Tom's claim is stored, and Eva's fails the
 * version check: a conflict, not a takeover she never saw herself asking for.
 */
const db = testDatabase();
const clock = fixedClock("2026-10-12T12:00:00Z");
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const eva = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;

/** Waits until `count` statements of this database wait for the defect's row. */
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

describe("two team members and one defect", () => {
  it("ST-025: Two team members claim at the same time", async () => {
    await anExistingTeamMember(db, tom, "Tom");
    await anExistingTeamMember(db, eva, "Eva");
    const machineId = await aRegisteredMachine(db);
    const reported = await executeCommand(
      reportProblemAndTriageCommand,
      {
        machineId,
        description: "Left flipper barely moves",
        triage: {
          outcome: "defect-recorded",
          title: "Left flipper weak",
          priority: undefined,
          suitableForHelpers: false,
          machineStatus: undefined,
          machineVersion: undefined,
        },
      },
      { actor: tom, db, clock, newId: randomUUID },
    );
    if (!reported.ok || !reported.result.defectId) throw new Error("no defect recorded");
    const defectId = reported.result.defectId;

    let letGo!: () => void;
    const holding = db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM defect WHERE id = ${defectId} FOR UPDATE`);
      await new Promise<void>((resolve) => (letGo = resolve));
    });
    const claim = (actor: typeof tom) =>
      executeCommand(claimDefectCommand, { defectId, version: 0 }, { actor, db, clock, newId: randomUUID });
    // Both saw the unclaimed defect at version 0. Tom's save queues for the row first, then Eva's.
    const toms = claim(tom);
    await untilWaitingForLocks(1);
    const evas = claim(eva);
    await untilWaitingForLocks(2);
    letGo();
    await holding;

    expect(await toms).toEqual({ ok: true, result: { defectId, takenOverFrom: undefined } });
    const rejected = await evas;
    expect(rejected).toEqual({ ok: false, error: "version-conflict" });
    expect((await storedDefect(db, defectId))?.claim?.claimedBy).toBe(tom.teamMemberId);
    expect((await journalOf(db, { aggregateId: defectId })).map((entry) => [entry.type, entry.actor])).toEqual([
      ["EVT-DefectClaimed", tom],
    ]);
    // Eva is told that the defect has changed and asked to reload before claiming again.
    expect(!rejected.ok && commandErrorText(teamMessages, rejected.error)).toBe(
      "Jemand hat das inzwischen geändert. Bitte lade die Seite neu und versuche es noch einmal.",
    );
  });
});
