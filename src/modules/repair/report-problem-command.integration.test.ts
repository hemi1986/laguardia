import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { fixedClock } from "@/platform/clock";
import { executeCommand, journalOf, type Actor } from "@/platform/command";
import { testDatabase } from "@/test-support/database";
import { problemReportsOfMachine, reportProblemCommand } from ".";
import { changeDescriptionForTest } from "./problem-report-stand-ins.test-support";

const db = testDatabase();
const visitor: Actor = { kind: "visitor" };
const deps = { actor: visitor, db, clock: fixedClock("2026-09-27T10:00:00Z"), newId: randomUUID };

describe("CMD-ReportProblem as a creating command", () => {
  it("stores the new problem report at version 0 without loading anything", async () => {
    const machineId = randomUUID();

    const reported = await executeCommand(
      reportProblemCommand,
      { machineId, description: "Left flipper is weak" },
      deps,
    );
    if (!reported.ok) throw new Error(reported.error);
    const { problemReportId } = reported.result;

    expect(await problemReportsOfMachine(db, machineId)).toEqual([
      { id: problemReportId, description: "Left flipper is weak", reportedAt: new Date("2026-09-27T10:00:00Z") },
    ]);
    // Version 0: a change at version 0 is accepted, a second one at version 0 is not.
    const technician: Actor = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" };
    const change = (description: string) =>
      executeCommand(
        changeDescriptionForTest,
        { problemReportId, version: 0, description },
        { ...deps, actor: technician },
      );
    expect(await change("Left flipper is very weak")).toEqual({ ok: true, result: undefined });
    expect(await change("Left flipper is gone")).toEqual({ ok: false, error: "version-conflict" });
  });

  it("rejects a problem report without a description and stores nothing", async () => {
    const machineId = randomUUID();

    expect(await executeCommand(reportProblemCommand, { machineId, description: "  " }, deps)).toEqual({
      ok: false,
      error: "description-required",
    });
    expect(await problemReportsOfMachine(db, machineId)).toEqual([]);
    expect(await journalOf(db, { machineId })).toEqual([]);
  });

  it("journals the reported problem without its description", async () => {
    const machineId = randomUUID();

    await executeCommand(reportProblemCommand, { machineId, description: "Coin door jammed" }, deps);

    const entries = await journalOf(db, { machineId });
    expect(entries.map((e) => [e.type, e.data])).toEqual([["EVT-ProblemReported", {}]]);
    expect(JSON.stringify(entries)).not.toContain("Coin door jammed");
  });
});
