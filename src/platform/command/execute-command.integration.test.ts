import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { problemReportsOfMachine, reportProblemCommand } from "@/modules/repair";
import { fixedClock } from "@/platform/clock";
import { testDatabase } from "@/test-support/database";
import { anExistingTeamMember } from "@/test-support/team-members";
import { aggregateCommand, executeCommand, journalOf, type Actor, type AggregateStore } from ".";
import { aRegisteredMachine, journalSinceRegistration } from "@/test-support/machines";

const db = testDatabase();
const clock = fixedClock("2026-09-27T10:00:00Z");
const visitor: Actor = { kind: "visitor" };
const technicianId = randomUUID();
const technician = { kind: "team-member", teamMemberId: technicianId, role: "technician" } as const;
beforeAll(() => anExistingTeamMember(db, technician));

function deps(actor: Actor, newId: () => string = randomUUID) {
  return { actor, db, clock, newId };
}

describe("command layer", () => {
  it("stores exactly the command's domain events in the journal with type, time, actor, aggregate and machine", async () => {
    const machineId = await aRegisteredMachine(db);

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
        // No free text in the journal: the description lives only in the problem report, where it can be removed.
        data: {},
      },
    ]);
  });

  it("gives a created aggregate and its journal entry exactly the ID of the injected ID generator", async () => {
    const machineId = await aRegisteredMachine(db);
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

  // A rejection after writing (version conflict, rejected policy) is tested with the Repair stand-ins:
  // src/modules/repair/problem-report-version.integration.test.ts, problem-report-policies.integration.test.ts
  it("stores neither the aggregate change nor a journal entry when a command is rejected", async () => {
    const machineId = await aRegisteredMachine(db);
    const empty = await executeCommand(reportProblemCommand, { machineId, description: "  " }, deps(visitor));

    expect(empty).toEqual({ ok: false, error: "description-required" });
    expect(await problemReportsOfMachine(db, machineId)).toEqual([]);
    expect(await journalSinceRegistration(db, machineId)).toEqual([]);
  });

  it("rejects a command for team members called without an acting team member, before it runs", async () => {
    let ran = false;
    const teamOnly = aggregateCommand({
      id: "CMD-TestTeamOnly",
      allowedActors: ["helper", "technician"],
      store: memoryStore,
      creates: true,
      decide: () => {
        ran = true;
        return { ok: true as const, state: { id: "x" }, events: [] };
      },
      journal: () => ({ type: "EVT-TestNever", aggregate: { type: "AGG-Test", id: "x" }, machineId: null, data: {} }),
      result: () => undefined,
    });

    expect(await executeCommand(teamOnly, undefined, deps(visitor))).toEqual({ ok: false, error: "not-authorized" });
    expect(await executeCommand(teamOnly, undefined, deps({ kind: "system" }))).toEqual({
      ok: false,
      error: "not-authorized",
    });
    expect(ran).toBe(false);
  });

  it("refuses a successful command that journals no event", async () => {
    const silent = aggregateCommand({
      id: "CMD-TestSilent",
      allowedActors: ["visitor"],
      store: memoryStore,
      creates: true,
      decide: () => ({ ok: true as const, state: { id: "x" }, events: [] }),
      journal: () => ({ type: "EVT-TestNever", aggregate: { type: "AGG-Test", id: "x" }, machineId: null, data: {} }),
      result: () => undefined,
    });

    await expect(executeCommand(silent, undefined, deps(visitor))).rejects.toThrow(/journals no event/);
  });

  it("keeps the journal append-only: changing or deleting entries is refused by the database", async () => {
    const machineId = await aRegisteredMachine(db);
    await executeCommand(reportProblemCommand, { machineId, description: "Ball stuck" }, deps(visitor));

    await expect(
      db.execute(sql`UPDATE event_journal SET type = 'X' WHERE machine_id = ${machineId}`),
    ).rejects.toThrow();
    await expect(db.execute(sql`DELETE FROM event_journal WHERE machine_id = ${machineId}`)).rejects.toThrow();
    expect(await journalSinceRegistration(db, machineId)).toHaveLength(1);
  });
});

/** A store that keeps nothing – for tests of the layer's checks that never reach the database. */
const memoryStore: AggregateStore<{ id: string }> = {
  type: "AGG-Test",
  load: async () => undefined,
  insert: async () => {},
  update: async () => true,
};
