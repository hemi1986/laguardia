import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { fixedClock } from "@/platform/clock";
import { executeCommand, journalOf, type Actor } from "@/platform/command";
import { testDatabase } from "@/test-support/database";
import { problemReportsOfMachine } from ".";
import { reportWithPolicyForTest, reportWithRejectedPolicyForTest } from "./problem-report-stand-ins.test-support";

const db = testDatabase();
const technician: Actor = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" };
const deps = { actor: technician, db, clock: fixedClock("2026-09-27T10:00:00Z"), newId: randomUUID };

describe("automatic policies triggered by a command", () => {
  it("runs an automatic policy as the system actor in the same transaction and journals it as the system", async () => {
    const outcome = await executeCommand(
      reportWithPolicyForTest,
      { machineId: randomUUID(), description: "Tilt bob missing" },
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
    const machineId = randomUUID();

    const outcome = await executeCommand(
      reportWithRejectedPolicyForTest,
      { machineId, description: "Tilt bob missing" },
      deps,
    );

    expect(outcome).toEqual({ ok: false, error: "policy-rejected" });
    expect(await problemReportsOfMachine(db, machineId)).toEqual([]);
    expect(await journalOf(db, { machineId })).toEqual([]);
  });
});
