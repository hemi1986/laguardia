import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { fixedClock } from "@/platform/clock";
import { executeCommand, journalOf, type Actor } from "@/platform/command";
import { testDatabase } from "@/test-support/database";
import { problemReportsOfMachine, reportProblemCommand } from ".";
import { changeDescriptionForTest, storedProblemReport } from "./problem-report-stand-ins.test-support";
import { aRegisteredMachine, journalSinceRegistration } from "@/test-support/machines";
import { anExistingTeamMember } from "@/test-support/team-members";

const db = testDatabase();
const visitor: Actor = { kind: "visitor" };
const deps = { actor: visitor, db, clock: fixedClock("2026-09-27T10:00:00Z"), newId: randomUUID };

describe("CMD-ReportProblem as a creating command", () => {
  it("stores the new problem report at version 0", async () => {
    const machineId = await aRegisteredMachine(db);

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
    const machineId = await aRegisteredMachine(db);

    expect(await executeCommand(reportProblemCommand, { machineId, description: "  " }, deps)).toEqual({
      ok: false,
      error: "description-required",
    });
    expect(await problemReportsOfMachine(db, machineId)).toEqual([]);
    expect(await journalSinceRegistration(db, machineId)).toEqual([]);
  });

  it("journals the reported problem without its description", async () => {
    const machineId = await aRegisteredMachine(db);

    await executeCommand(reportProblemCommand, { machineId, description: "Coin door jammed" }, deps);

    const entries = await journalSinceRegistration(db, machineId);
    expect(entries.map((e) => [e.type, e.data])).toEqual([["EVT-ProblemReported", {}]]);
    expect(JSON.stringify(entries)).not.toContain("Coin door jammed");
  });
});

describe("CMD-ReportProblem by a visitor", () => {
  // The scenario "ST-013: Visitor reports a problem" runs in the browser (e2e/report-problem.spec.ts); here what is stored.
  it("stores a visitor's problem report with its description, the reporter visitor and the time it was reported", async () => {
    const machineId = await aRegisteredMachine(db);

    const reported = await executeCommand(
      reportProblemCommand,
      { machineId, description: "Ball stuck behind the left ramp" },
      { ...deps, clock: fixedClock("2026-10-03T14:30:00Z") },
    );

    if (!reported.ok) throw new Error(reported.error);
    const { problemReportId } = reported.result;
    expect(await storedProblemReport(db, problemReportId)).toEqual({
      id: problemReportId,
      machineId,
      description: "Ball stuck behind the left ramp",
      reporter: { kind: "visitor" },
      reportedAt: new Date("2026-10-03T14:30:00Z"),
    });
    expect((await journalOf(db, { aggregateId: problemReportId })).map((e) => [e.type, e.actor])).toEqual([
      ["EVT-ProblemReported", { kind: "visitor" }],
    ]);
  });

  it("ST-013: No reporting for machines not on display", async () => {
    const machineId = await aRegisteredMachine(db, "not-on-display");

    expect(await executeCommand(reportProblemCommand, { machineId, description: "Ball stuck" }, deps)).toEqual({
      ok: false,
      error: "machine-not-on-display",
    });
    expect(await problemReportsOfMachine(db, machineId)).toEqual([]);
    expect(await journalSinceRegistration(db, machineId)).toEqual([]);
  });

  it("accepts a description of 2000 characters and rejects one of 2001, storing nothing", async () => {
    const machineId = await aRegisteredMachine(db);

    expect((await executeCommand(reportProblemCommand, { machineId, description: "x".repeat(2000) }, deps)).ok).toBe(true);
    expect(await executeCommand(reportProblemCommand, { machineId, description: "y".repeat(2001) }, deps)).toEqual({
      ok: false,
      error: "description-too-long",
    });
    expect((await problemReportsOfMachine(db, machineId)).map((report) => report.description.length)).toEqual([2000]);
  });

  it("rejects a problem report for a machine that does not exist, storing nothing", async () => {
    expect(
      await executeCommand(reportProblemCommand, { machineId: randomUUID(), description: "Ball stuck" }, deps),
    ).toEqual({ ok: false, error: "machine-not-found" });
    expect(await executeCommand(reportProblemCommand, { machineId: "", description: "Ball stuck" }, deps)).toEqual({
      ok: false,
      error: "machine-not-found",
    });
  });

  it("lets a team member report for a machine not on display – the visitors' rule only", async () => {
    const machineId = await aRegisteredMachine(db, "not-on-display");
    const helper = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;
    await anExistingTeamMember(db, helper);

    const reported = await executeCommand(reportProblemCommand, { machineId, description: "Coil burnt" }, {
      ...deps,
      actor: helper,
    });

    expect(reported.ok).toBe(true);
    expect((await problemReportsOfMachine(db, machineId)).map((report) => report.description)).toEqual(["Coil burnt"]);
  });
});
