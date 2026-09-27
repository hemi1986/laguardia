import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { fixedClock } from "@/platform/clock";
import { executeCommand, journalOf } from "@/platform/command";
import { testDatabase } from "@/test-support/database";
import { anExistingTeamMember } from "@/test-support/team-members";
import { problemReportsOfMachine, reportProblemCommand } from ".";
import {
  changeDescriptionForTest,
  changeWithoutVersionForTest,
  splitForTest,
} from "./problem-report-stand-ins.test-support";
import { problemReports } from "./problem-reports";

const db = testDatabase();
const technician = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
beforeAll(() => anExistingTeamMember(db, technician));
const deps = { actor: technician, db, clock: fixedClock("2026-09-27T10:00:00Z"), newId: randomUUID };

async function reportedProblem(machineId = randomUUID()) {
  const created = await executeCommand(reportProblemCommand, { machineId, description: "Display flickers" }, deps);
  if (!created.ok) throw new Error(created.error);
  return { machineId, problemReportId: created.result.problemReportId };
}

const change = (problemReportId: string, version: number, description: string) =>
  executeCommand(changeDescriptionForTest, { problemReportId, version, description }, deps);

describe("commands on an existing problem report: load, decide, save (HS-16)", () => {
  it("loads the problem report, decides and saves it one version higher", async () => {
    const { machineId, problemReportId } = await reportedProblem();

    expect(await change(problemReportId, 0, "Display flickers badly")).toEqual({ ok: true, result: undefined });
    expect(await change(problemReportId, 1, "Display dark")).toEqual({ ok: true, result: undefined });

    expect((await problemReportsOfMachine(db, machineId)).map((r) => r.description)).toEqual(["Display dark"]);
  });

  it("lets exactly one of two concurrent commands on the same aggregate version succeed", async () => {
    const { problemReportId } = await reportedProblem();

    const outcomes = await Promise.all(["A", "B"].map((description) => change(problemReportId, 0, description)));

    expect(outcomes.filter((o) => o.ok)).toHaveLength(1);
    expect(outcomes.filter((o) => !o.ok)).toEqual([{ ok: false, error: "version-conflict" }]);
    expect((await journalOf(db, { aggregateId: problemReportId })).map((e) => e.type)).toEqual([
      "EVT-ProblemReported",
      "EVT-TestDescriptionChanged",
    ]);
  });

  it("returns the domain rejection, not a version conflict, when the fresh state explains it", async () => {
    const { machineId, problemReportId } = await reportedProblem();
    await change(problemReportId, 0, "Display dark"); // Eva was first

    // Tom saw version 0 and wants the same change: the decision on the fresh state rejects it.
    expect(await change(problemReportId, 0, "Display dark")).toEqual({ ok: false, error: "description-unchanged" });
    // Tom saw version 0 and wants another change: nothing domain-specific explains it – a version conflict.
    expect(await change(problemReportId, 0, "Display flickers badly")).toEqual({
      ok: false,
      error: "version-conflict",
    });

    expect((await problemReportsOfMachine(db, machineId)).map((r) => r.description)).toEqual(["Display dark"]);
    expect((await journalOf(db, { aggregateId: problemReportId })).map((e) => e.type)).toEqual([
      "EVT-ProblemReported",
      "EVT-TestDescriptionChanged",
    ]);
  });

  it("rejects a change of a problem report that does not exist as not found, not as a version conflict", async () => {
    expect(await change(randomUUID(), 0, "A")).toEqual({ ok: false, error: "not-found" });
  });

  it("saves a new aggregate the decision creates together with the changed one, in one transaction", async () => {
    const { machineId, problemReportId } = await reportedProblem();

    const outcome = await executeCommand(splitForTest, { problemReportId, version: 0, splitOff: "Coin door" }, deps);

    expect(outcome.ok).toBe(true);
    expect((await problemReportsOfMachine(db, machineId)).map((r) => r.description).sort()).toEqual([
      "Coin door",
      "Display flickers (split)",
    ]);
  });

  it("saves neither the changed nor the created aggregate when the command fails on its version", async () => {
    const { machineId, problemReportId } = await reportedProblem();
    await change(problemReportId, 0, "Display dark");

    const outcome = await executeCommand(splitForTest, { problemReportId, version: 0, splitOff: "Coin door" }, deps);

    expect(outcome).toEqual({ ok: false, error: "version-conflict" });
    expect((await problemReportsOfMachine(db, machineId)).map((r) => r.description)).toEqual(["Display dark"]);
  });

  it("keeps the fields the decision did not change when it saves", async () => {
    const reportedBy = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;
    await anExistingTeamMember(db, reportedBy);
    const created = await executeCommand(
      reportProblemCommand,
      { machineId: randomUUID(), description: "Display flickers" },
      { ...deps, actor: reportedBy },
    );
    if (!created.ok) throw new Error(created.error);
    const { problemReportId } = created.result;
    const before = await problemReports.load(db, problemReportId);

    await change(problemReportId, 0, "Display dark");

    expect(await problemReports.load(db, problemReportId)).toEqual({
      state: { ...before!.state, description: "Display dark" },
      version: 1,
    });
  });

  it("refuses a team command that does not pass the version the acting person saw", async () => {
    const { problemReportId } = await reportedProblem();

    await expect(
      executeCommand(changeWithoutVersionForTest, { problemReportId, description: "Display dark" }, deps),
    ).rejects.toThrow(/version the acting person saw/);
  });
});
