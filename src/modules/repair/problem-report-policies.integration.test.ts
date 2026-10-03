import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, expectTypeOf, it } from "vitest";
import { fixedClock } from "@/platform/clock";
import { executeCommand, journalOf } from "@/platform/command";
import { testDatabase } from "@/test-support/database";
import { anExistingTeamMember } from "@/test-support/team-members";
import { problemReportsOfMachine } from ".";
import {
  changeDescriptionForTest,
  policyForTest,
  reportWithIdlePolicyForTest,
  reportWithPolicyForTest,
  reportWithRejectedPolicyForTest,
} from "./problem-report-stand-ins.test-support";
import { problemReports } from "./problem-reports";
import { aRegisteredMachine, journalSinceRegistration } from "@/test-support/machines";

const db = testDatabase();
const technician = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
beforeAll(() => anExistingTeamMember(db, technician));
const deps = { actor: technician, db, clock: fixedClock("2026-09-27T10:00:00Z"), newId: randomUUID };

describe("automatic policies triggered by a command", () => {
  it("runs an automatic policy as the system actor in the same transaction and journals it as the system", async () => {
    const outcome = await executeCommand(
      reportWithPolicyForTest,
      { machineId: await aRegisteredMachine(db), description: "Tilt bob missing" },
      deps,
    );

    if (!outcome.ok) throw new Error(outcome.error);
    expect(
      (await journalOf(db, { aggregateId: outcome.result.problemReportId })).map((e) => [e.type, e.actor]),
    ).toEqual([
      ["EVT-ProblemReported", technician],
      ["EVT-TestPolicyApplied", { kind: "system" }],
    ]);
  });

  it("rejects the whole command, including the triggering change, when its automatic policy is rejected", async () => {
    const machineId = await aRegisteredMachine(db);

    const outcome = await executeCommand(
      reportWithRejectedPolicyForTest,
      { machineId, description: "Tilt bob missing" },
      deps,
    );

    expect(outcome).toEqual({ ok: false, error: "policy-rejected" });
    // The policy's error is part of the triggering command's result type.
    if (!outcome.ok)
      expectTypeOf(outcome.error).toEqualTypeOf<
        | "machine-not-found"
        | "machine-not-on-display"
        | "description-required"
        | "policy-rejected"
        | "not-authorized"
        | "not-found"
        | "version-conflict"
      >();
    expect(await problemReportsOfMachine(db, machineId)).toEqual([]);
    expect(await journalSinceRegistration(db, machineId)).toEqual([]);
  });

  it("saves nothing and keeps the version when a policy has nothing to do", async () => {
    const reported = await executeCommand(
      reportWithIdlePolicyForTest,
      { machineId: await aRegisteredMachine(db), description: "Tilt bob missing" },
      deps,
    );
    if (!reported.ok) throw new Error(reported.error);
    const { problemReportId } = reported.result;

    // The problem report is still at version 0: a change at version 0 is accepted.
    expect(
      await executeCommand(changeDescriptionForTest, { problemReportId, version: 0, description: "Tilt" }, deps),
    ).toEqual({ ok: true, result: undefined });
    expect((await journalOf(db, { aggregateId: problemReportId })).map((e) => e.type)).toEqual([
      "EVT-ProblemReported",
      "EVT-TestDescriptionChanged",
    ]);
  });

  it("lets concurrent policies on the same aggregate both succeed – a policy saw no version to conflict with", async () => {
    const reported = await executeCommand(
      reportWithIdlePolicyForTest,
      { machineId: await aRegisteredMachine(db), description: "Tilt bob missing" },
      deps,
    );
    if (!reported.ok) throw new Error(reported.error);
    const { problemReportId } = reported.result;
    const asSystem = { ...deps, actor: { kind: "system" } as const };

    const outcomes = await Promise.all(
      Array.from({ length: 6 }, () => executeCommand(policyForTest, { problemReportId }, asSystem)),
    );

    expect(outcomes).toEqual(Array.from({ length: 6 }, () => ({ ok: true, result: undefined })));
    expect((await journalOf(db, { aggregateId: problemReportId })).map((e) => e.type)).toEqual([
      "EVT-ProblemReported",
      ...Array.from({ length: 6 }, () => "EVT-TestPolicyApplied"),
    ]);
    expect((await problemReports.load(db, problemReportId))?.version).toBe(6);
  });
});
