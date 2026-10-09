import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  linkProblemReportToDefectCommand,
  recordDefectCommand,
  reportProblemCommand,
  resolveProblemOnTheSpotCommand,
} from "@/modules/repair";
import { storedProblemReport } from "@/modules/repair/problem-report-stand-ins.test-support";
import { fixedClock } from "@/platform/clock";
import { executeCommand } from "@/platform/command";
import { testDatabase } from "@/test-support/database";
import { aRegisteredMachine } from "@/test-support/machines";
import { anExistingTeamMember } from "@/test-support/team-members";
import { triageRejectionText } from "../triage-rejection-text";
import { withWhoTriagedFirst } from "../who-triaged-first";
import { linkToDefectInput } from "./link-to-defect-input";

/**
 * What the form „Mit Defekt verknüpfen“ says when it is rejected (ST-022, story review 2026-10-03): who triaged the
 * problem report first, that a defect must be chosen, and that the chosen defect can no longer be linked.
 */
const db = testDatabase();
const clock = fixedClock("2026-10-09T10:00:00Z");
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
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

describe("a rejected „Mit Defekt verknüpfen“", () => {
  it("ST-022: Already triaged problem report", async () => {
    await anExistingTeamMember(db, tom, "Tom");
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
      { actor: tom, db, clock, newId: randomUUID },
    );
    if (!recorded.ok) throw new Error(recorded.error);
    const problemReportId = await reported(machineId, "Flipper on the left does nothing");
    const byTom = await executeCommand(
      resolveProblemOnTheSpotCommand,
      { problemReportId, version: 0, note: "Cleaned the flipper switch" },
      { actor: tom, db, clock, newId: randomUUID },
    );
    if (!byTom.ok) throw new Error(byTom.error);

    const values = { version: "0", defectId: recorded.result.defectId };
    const tried = await executeCommand(linkProblemReportToDefectCommand, linkToDefectInput(values, problemReportId), {
      actor: eva,
      db,
      clock,
      newId: randomUUID,
    });
    expect(tried).toEqual({ ok: false, error: "already-triaged" });
    if (tried.ok) return;
    // Nothing is linked: the problem report keeps Tom's triage.
    expect((await storedProblemReport(db, problemReportId))?.triage).toMatchObject({
      outcome: "resolved-on-the-spot",
      triagedBy: tom.teamMemberId,
    });

    const state = await withWhoTriagedFirst(db, clock, problemReportId, { error: tried.error, values });

    expect(state).toEqual({ error: "already-triaged", values, triagedBy: "Tom" });
    expect(triageRejectionText(state!)).toBe("Tom hat diese Meldung schon gesichtet.");
  });

  it("says that a defect must be chosen, or that the chosen one can no longer be linked, in the catalogue's words", () => {
    expect(triageRejectionText({ error: "defect-required" })).toBe("Bitte einen Defekt auswählen.");
    expect(triageRejectionText({ error: "defect-not-open" })).toBe("Dieser Defekt ist nicht mehr offen.");
    expect(triageRejectionText({ error: "defect-of-another-machine" })).toBe(
      "Dieser Defekt gehört zu einem anderen Gerät.",
    );
  });

  it("reads no chosen defect as none, and a version nobody saw as -1", () => {
    expect(linkToDefectInput({ version: "3", defectId: "" }, "report")).toEqual({
      problemReportId: "report",
      version: 3,
      defectId: undefined,
    });
    expect(linkToDefectInput({ version: "x", defectId: undefined }, "report")).toMatchObject({
      version: -1,
      defectId: undefined,
    });
  });
});
