import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { dismissProblemReportCommand, reportProblemCommand, resolveProblemOnTheSpotCommand } from "@/modules/repair";
import { storedProblemReport } from "@/modules/repair/problem-report-stand-ins.test-support";
import { fixedClock } from "@/platform/clock";
import { executeCommand } from "@/platform/command";
import { testDatabase } from "@/test-support/database";
import { aRegisteredMachine } from "@/test-support/machines";
import { anExistingTeamMember } from "@/test-support/team-members";
import { triageRejectionText } from "../triage-rejection-text";
import { withWhoTriagedFirst } from "../who-triaged-first";

/**
 * What the form „Meldung verwerfen“ says when it is rejected (ST-020, story review 2026-10-03): who triaged the problem
 * report first, that a reason must be chosen, and that the reason *other* must be described.
 */
const db = testDatabase();
const clock = fixedClock("2026-10-09T10:00:00Z");
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const eva = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const values = { version: "0", reason: "not-a-fault", reasonText: "" };

describe("a rejected „Meldung verwerfen“", () => {
  it("ST-020: Already triaged problem report", async () => {
    await anExistingTeamMember(db, tom, "Tom");
    await anExistingTeamMember(db, eva, "Eva");
    const machineId = await aRegisteredMachine(db);
    const reported = await executeCommand(
      reportProblemCommand,
      { machineId, description: "Way too hard to score" },
      { actor: { kind: "visitor" }, db, clock, newId: randomUUID },
    );
    if (!reported.ok) throw new Error(reported.error);
    const problemReportId = reported.result.problemReportId;
    const byTom = await executeCommand(
      resolveProblemOnTheSpotCommand,
      { problemReportId, version: 0, note: "Explained the scoring to the visitor" },
      { actor: tom, db, clock, newId: randomUUID },
    );
    if (!byTom.ok) throw new Error(byTom.error);

    const tried = await executeCommand(
      dismissProblemReportCommand,
      { problemReportId, version: 0, reason: "not-a-fault", reasonText: "" },
      { actor: eva, db, clock, newId: randomUUID },
    );
    expect(tried).toEqual({ ok: false, error: "already-triaged" });
    if (tried.ok) return;
    // Nothing is dismissed: the problem report keeps Tom's triage.
    expect((await storedProblemReport(db, problemReportId))?.triage).toMatchObject({
      outcome: "resolved-on-the-spot",
      triagedBy: tom.teamMemberId,
    });

    const state = await withWhoTriagedFirst(db, clock, problemReportId, { error: tried.error, values });

    expect(state).toEqual({ error: "already-triaged", values, triagedBy: "Tom" });
    expect(triageRejectionText(state!)).toBe("Tom hat diese Meldung schon gesichtet.");
  });

  it("asks for a reason, and for a description of the reason other, in the catalogue's words", async () => {
    expect(triageRejectionText({ error: "dismissal-reason-required" })).toBe(
      "Bitte einen Grund auswählen.",
    );
    expect(triageRejectionText({ error: "dismissal-reason-text-required" })).toBe(
      "Bitte den Grund beschreiben.",
    );
  });
});
