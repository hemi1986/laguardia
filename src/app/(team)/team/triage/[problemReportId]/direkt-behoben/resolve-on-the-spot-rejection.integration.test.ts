import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { recordDefectCommand, reportProblemCommand, resolveProblemOnTheSpotCommand } from "@/modules/repair";
import { fixedClock } from "@/platform/clock";
import { executeCommand } from "@/platform/command";
import { testDatabase } from "@/test-support/database";
import { aRegisteredMachine } from "@/test-support/machines";
import { anExistingTeamMember } from "@/test-support/team-members";
import { withWhoTriagedFirst } from "../who-triaged-first";
import { rejectionText } from "./resolve-on-the-spot-rejection-text";

/**
 * What the form „Direkt behoben“ says when it is rejected (ST-019, story review 2026-10-03): who triaged the problem
 * report first, and that a note is needed.
 */
const db = testDatabase();
const clock = fixedClock("2026-10-05T10:00:00Z");
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const anna = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;
const values = { version: "0", note: "Ball freed, ramp OK" };

describe("a rejected „Direkt behoben“", () => {
  it("ST-019: Already triaged problem report", async () => {
    await anExistingTeamMember(db, tom, "Tom");
    await anExistingTeamMember(db, anna, "Anna");
    const machineId = await aRegisteredMachine(db);
    const reported = await executeCommand(
      reportProblemCommand,
      { machineId, description: "Ball stuck behind the left ramp" },
      { actor: { kind: "visitor" }, db, clock, newId: randomUUID },
    );
    if (!reported.ok) throw new Error(reported.error);
    const problemReportId = reported.result.problemReportId;
    const byTom = await executeCommand(
      recordDefectCommand,
      {
        problemReportId,
        version: 0,
        title: "Left ramp catches balls",
        priority: undefined,
        suitableForHelpers: false,
        machineStatus: undefined,
        machineVersion: undefined,
      },
      { actor: tom, db, clock, newId: randomUUID },
    );
    if (!byTom.ok) throw new Error(byTom.error);

    const tried = await executeCommand(
      resolveProblemOnTheSpotCommand,
      { problemReportId, version: 0, note: "Ball freed, ramp OK" },
      { actor: anna, db, clock, newId: randomUUID },
    );
    expect(tried).toEqual({ ok: false, error: "already-triaged" });
    if (tried.ok) return;

    const state = await withWhoTriagedFirst(db, clock, problemReportId, { error: tried.error, values });

    expect(state).toEqual({ error: "already-triaged", values, triagedBy: "Tom" });
    expect(rejectionText(state!)).toBe("Tom hat diese Meldung schon gesichtet.");
  });

  it("asks for a note in the catalogue's words", async () => {
    const state = { error: "note-required" as const, values: { version: "0", note: "" } };

    expect(await withWhoTriagedFirst(db, clock, randomUUID(), state)).toBe(state);
    expect(rejectionText(state)).toBe("Bitte kurz beschreiben, was gemacht wurde.");
  });
});
