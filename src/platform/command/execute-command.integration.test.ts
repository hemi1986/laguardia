import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { problemReportsOfMachine, reportProblemCommand } from "@/modules/repair";
import { fixedClock } from "@/platform/clock";
import { testDatabase } from "@/test-support/database";
import { defineCommand, executeCommand, journalOf, type Actor } from ".";

const db = testDatabase();
const clock = fixedClock("2026-09-27T10:00:00Z");
const visitor: Actor = { kind: "visitor" };
const technicianId = randomUUID();
const technician: Actor = { kind: "team-member", teamMemberId: technicianId, role: "technician" };

function deps(actor: Actor, newId: () => string = randomUUID) {
  return { actor, db, clock, newId };
}

describe("command layer", () => {
  it("stores exactly the command's domain events in the journal with type, time, actor, aggregate and machine", async () => {
    const machineId = randomUUID();

    const outcome = await executeCommand(
      reportProblemCommand,
      { machineId, description: "Left flipper is weak" },
      deps(technician),
    );

    if (!outcome.ok) throw new Error(outcome.error);
    expect(await journalOf(db, { aggregateId: outcome.result.problemReportId })).toEqual([
      {
        type: "EVT-ProblemReported",
        occurredAt: new Date("2026-09-27T10:00:00Z"),
        actor: technician,
        aggregate: { type: "AGG-ProblemReport", id: outcome.result.problemReportId },
        machineId,
        data: {
          description: "Left flipper is weak",
          reporter: { kind: "team-member", teamMemberId: technicianId },
        },
      },
    ]);
  });

  it("gives a created aggregate and its journal entry exactly the ID of the injected ID generator", async () => {
    const machineId = randomUUID();
    const expectedId = "0b4f8a52-6c1e-4b8e-9d0a-3f2c1e7d9a11";

    const outcome = await executeCommand(
      reportProblemCommand,
      { machineId, description: "Coin door jammed" },
      deps(visitor, () => expectedId),
    );

    expect(outcome).toEqual({ ok: true, result: { problemReportId: expectedId } });
    expect((await problemReportsOfMachine(db, machineId)).map((r) => r.id)).toEqual([expectedId]);
    expect((await journalOf(db, { aggregateId: expectedId })).map((e) => e.aggregate)).toEqual([
      { type: "AGG-ProblemReport", id: expectedId },
    ]);
  });

  it("stores neither the aggregate change nor a journal entry when a command is rejected", async () => {
    const machineId = randomUUID();
    const reportThenReject = defineCommand({
      id: "CMD-TestReportThenReject",
      allowedActors: ["visitor"],
      run: async (_input: void, context) => {
        const written = await reportProblemCommand.run(
          { machineId, description: "written before the rejection" },
          context,
        );
        if (!written.ok) throw new Error(written.error);
        return { ok: false as const, error: "rejected-after-writing" };
      },
    });

    const empty = await executeCommand(reportProblemCommand, { machineId, description: "  " }, deps(visitor));
    const afterWriting = await executeCommand(reportThenReject, undefined, deps(visitor));

    expect(empty).toEqual({ ok: false, error: "description-required" });
    expect(afterWriting).toEqual({ ok: false, error: "rejected-after-writing" });
    expect(await problemReportsOfMachine(db, machineId)).toEqual([]);
    expect(await journalOf(db, { machineId })).toEqual([]);
  });

  it("rejects a command for team members called without an acting team member, before it runs", async () => {
    let ran = false;
    const teamOnly = defineCommand({
      id: "CMD-TestTeamOnly",
      allowedActors: ["helper", "technician"],
      run: async () => {
        ran = true;
        return { ok: true as const, result: undefined, events: [] };
      },
    });

    expect(await executeCommand(teamOnly, undefined, deps(visitor))).toEqual({ ok: false, error: "not-authorized" });
    expect(await executeCommand(teamOnly, undefined, deps({ kind: "system" }))).toEqual({
      ok: false,
      error: "not-authorized",
    });
    expect(ran).toBe(false);
  });

  it("runs an automatic policy as the system actor in the same transaction and journals it as the system", async () => {
    const machineId = randomUUID();
    const reportWithPolicy = defineCommand({
      id: "CMD-TestReportWithPolicy",
      allowedActors: ["technician"],
      run: async (input: { machineId: string }, context) => {
        const reported = await reportProblemCommand.run({ ...input, description: "Tilt bob missing" }, context);
        if (!reported.ok) return reported;
        await context.runAsSystem(policyForTest, { problemReportId: reported.result.problemReportId });
        return reported;
      },
    });

    const outcome = await executeCommand(reportWithPolicy, { machineId }, deps(technician));

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
    const reportWithRejectedPolicy = defineCommand({
      id: "CMD-TestReportWithRejectedPolicy",
      allowedActors: ["technician"],
      run: async (input: { machineId: string }, context) => {
        const reported = await reportProblemCommand.run({ ...input, description: "Tilt bob missing" }, context);
        if (!reported.ok) return reported;
        await context.runAsSystem(policyForTest, { problemReportId: reported.result.problemReportId, reject: true });
        return reported;
      },
    });

    const outcome = await executeCommand(reportWithRejectedPolicy, { machineId }, deps(technician));

    expect(outcome).toEqual({ ok: false, error: "policy-rejected" });
    expect(await problemReportsOfMachine(db, machineId)).toEqual([]);
    expect(await journalOf(db, { machineId })).toEqual([]);
  });

  it("refuses a successful command that journals no event", async () => {
    const silent = defineCommand({
      id: "CMD-TestSilent",
      allowedActors: ["visitor"],
      run: async () => ({ ok: true as const, result: undefined, events: [] }),
    });

    await expect(executeCommand(silent, undefined, deps(visitor))).rejects.toThrow(/journals no event/);
  });

  it("keeps the journal append-only: changing or deleting entries is refused by the database", async () => {
    const machineId = randomUUID();
    await executeCommand(reportProblemCommand, { machineId, description: "Ball stuck" }, deps(visitor));

    await expect(
      db.execute(sql`UPDATE event_journal SET type = 'X' WHERE machine_id = ${machineId}`),
    ).rejects.toThrow();
    await expect(db.execute(sql`DELETE FROM event_journal WHERE machine_id = ${machineId}`)).rejects.toThrow();
    expect(await journalOf(db, { machineId })).toHaveLength(1);
  });
});

/** A stand-in for the automatic policies (e.g. POL-RetirementClosesDefects): allowed for the system only. */
const policyForTest = defineCommand({
  id: "CMD-TestPolicy",
  allowedActors: ["system"],
  run: async (input: { problemReportId: string; reject?: boolean }) =>
    input.reject
      ? { ok: false as const, error: "policy-rejected" }
      : {
          ok: true as const,
          result: undefined,
          events: [
            {
              type: "EVT-TestPolicyApplied" as const,
              aggregate: { type: "AGG-ProblemReport" as const, id: input.problemReportId },
              machineId: null,
              data: {},
            },
          ],
        },
});
