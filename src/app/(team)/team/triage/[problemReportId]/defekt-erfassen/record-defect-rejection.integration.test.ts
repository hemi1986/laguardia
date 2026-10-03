import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { recordDefectCommand, reportProblemCommand } from "@/modules/repair";
import { fixedClock } from "@/platform/clock";
import { executeCommand } from "@/platform/command";
import { testDatabase } from "@/test-support/database";
import { aRegisteredMachine } from "@/test-support/machines";
import { anExistingTeamMember } from "@/test-support/team-members";
import { withWhoTriagedFirst } from "./record-defect-rejection";
import { rejectionText } from "./record-defect-rejection-text";

/**
 * What the form „Defekt erfassen“ says when it is rejected (ST-018, story review 2026-10-03): who triaged the problem
 * report first – the second of two technicians at the same moment gets this too (record-defect-concurrency test) –, and
 * that the machine was retired meanwhile.
 */
const db = testDatabase();
const clock = fixedClock("2026-10-04T09:00:00Z");
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const values = { version: "0", title: "Flipper coil weak", priority: "", suitableForHelpers: "", machineStatus: "", machineVersion: "" };

describe("a rejected „Defekt erfassen“", () => {
  it("names who triaged the problem report first, with the way back to the triage list", async () => {
    await anExistingTeamMember(db, tom, "Tom");
    const machineId = await aRegisteredMachine(db);
    const reported = await executeCommand(
      reportProblemCommand,
      { machineId, description: "Left flipper barely moves" },
      { actor: { kind: "visitor" }, db, clock, newId: randomUUID },
    );
    if (!reported.ok) throw new Error(reported.error);
    const problemReportId = reported.result.problemReportId;
    const first = await executeCommand(
      recordDefectCommand,
      {
        problemReportId,
        version: 0,
        title: "Left flipper weak",
        priority: undefined,
        suitableForHelpers: false,
        machineStatus: undefined,
        machineVersion: undefined,
      },
      { actor: tom, db, clock, newId: randomUUID },
    );
    if (!first.ok) throw new Error(first.error);

    const state = await withWhoTriagedFirst(db, clock, problemReportId, { error: "already-triaged", values });

    expect(state).toEqual({ error: "already-triaged", values, triagedBy: "Tom" });
    expect(rejectionText(state!, "LG-042")).toBe("Tom hat diese Meldung schon gesichtet.");
  });

  it("says the machine was retired meanwhile and nothing was saved", () => {
    expect(rejectionText({ error: "machine-retired", values }, "LG-042")).toBe(
      "LG-042 ist inzwischen ausgemustert. Es wurde nichts gespeichert.",
    );
  });

  it("leaves every other rejection as it is, in the catalogue's words", async () => {
    const state = { error: "title-required" as const, values };

    expect(await withWhoTriagedFirst(db, clock, randomUUID(), state)).toBe(state);
    expect(rejectionText(state, "LG-042")).toBe("Bitte einen Titel angeben.");
  });
});
