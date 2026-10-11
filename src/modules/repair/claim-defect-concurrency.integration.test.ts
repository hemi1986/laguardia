import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { fixedClock } from "@/platform/clock";
import { executeCommand, journalOf } from "@/platform/command";
import { commandErrorText, teamMessages } from "@/platform/messages";
import { testDatabase } from "@/test-support/database";
import { aRegisteredMachine } from "@/test-support/machines";
import { whileHoldingRow } from "@/test-support/held-row";
import { anExistingTeamMember } from "@/test-support/team-members";
import { defectDetails, claimDefectCommand, reportProblemAndTriageCommand } from ".";

/**
 * Two team members claim the same defect at the same time (ST-025, ST-003) – two real transactions on the same version
 * of the defect, not a sequence. A third transaction holds the defect's row until both have loaded version 0 and
 * decided; Tom's save waits for it first, Eva's second – PostgreSQL serves the waiters of a row in that order. When it lets go, Tom's claim is stored, and Eva's fails the
 * version check: a conflict, not a takeover she never saw herself asking for.
 */
const db = testDatabase();
const clock = fixedClock("2026-10-12T12:00:00Z");
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const eva = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;

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

    const claim = (actor: typeof tom) =>
      executeCommand(claimDefectCommand, { defectId, version: 0 }, { actor, db, clock, newId: randomUUID });
    // Both saw the unclaimed defect at version 0. Tom's save queues for the row first, then Eva's.
    const { toms, evas } = await whileHoldingRow(
      db,
      sql`SELECT id FROM defect WHERE id = ${defectId} FOR UPDATE`,
      async (untilWaiting) => {
        const toms = claim(tom);
        await untilWaiting(1);
        const evas = claim(eva);
        await untilWaiting(2);
        return { toms, evas };
      },
    );

    expect(await toms).toEqual({ ok: true, result: { defectId } });
    const rejected = await evas;
    expect(rejected).toEqual({ ok: false, error: "version-conflict" });
    expect((await defectDetails(db, defectId))?.claim?.claimedBy).toBe(tom.teamMemberId);
    expect((await journalOf(db, { aggregateId: defectId })).map((entry) => [entry.type, entry.actor])).toEqual([
      ["EVT-DefectClaimed", tom],
    ]);
    // Eva is told that the defect has changed and asked to reload before claiming again.
    expect(!rejected.ok && commandErrorText(teamMessages, rejected.error)).toBe(
      "Jemand hat das inzwischen geändert. Bitte lade die Seite neu und versuche es noch einmal.",
    );
  });
});
