import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { problemReportsOfMachine, reportProblemCommand } from "@/modules/repair";
import { fixedClock } from "@/platform/clock";
import { testDatabase } from "@/test-support/database";
import { anExistingTeamMember } from "@/test-support/team-members";
import { aggregateCommand, executeCommand, journalOf, withPolicies, type Actor, type AggregateStore } from ".";
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
    // A helper: a technician's own problem report needs its triage outcome in the same step (ST-023).
    const helper = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;
    await anExistingTeamMember(db, helper);

    const outcome = await executeCommand(
      reportProblemCommand,
      { machineId, description: "Left flipper is weak" },
      deps(helper),
    );

    if (!outcome.ok) throw new Error(outcome.error);
    expect(await journalOf(db, { aggregateId: outcome.result.problemReportId })).toEqual([
      {
        type: "EVT-ProblemReported",
        occurredAt: new Date("2026-09-27T10:00:00Z"),
        actor: helper,
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

  describe("a set delta (ST-095): no version, and may change nothing", () => {
    /** A store that holds one aggregate at version 3 and notes how it was loaded and saved. */
    function countingStore() {
      const seen: { lock?: boolean; savedAt?: number } = {};
      const store: AggregateStore<{ id: string }> = {
        type: "AGG-Test",
        load: async (_tx, id, options) => {
          seen.lock = options?.lock;
          return { state: { id }, version: 3 };
        },
        insert: async () => {},
        update: async (_tx, _state, expectedVersion) => {
          seen.savedAt = expectedVersion;
          return true;
        },
      };
      return { store, seen };
    }
    const journal = () => ({
      type: "EVT-TestDone" as const,
      aggregate: { type: "AGG-Test" as const, id: "x" },
      machineId: null,
      data: {},
    });
    const delta = (
      store: AggregateStore<{ id: string }>,
      extra: { setDelta?: true; mayChangeNothing?: true },
      events: number,
      version?: number,
    ) =>
      aggregateCommand({
        id: "CMD-TestDelta",
        allowedActors: ["technician"],
        store,
        target: () => ({ id: "x", version }),
        decide: (state) => ({
          ok: true as const,
          state,
          events: Array.from({ length: events }, () => ({ type: "EVT-TestDone" })),
        }),
        journal,
        result: () => undefined,
        ...extra,
      });

    it("lets a person's command name no version: the row is locked and saved at the version it holds", async () => {
      const { store, seen } = countingStore();

      const outcome = await executeCommand(delta(store, { setDelta: true }, 1), undefined, deps(technician));

      expect(outcome).toEqual({ ok: true, result: undefined });
      expect(seen).toEqual({ lock: true, savedAt: 3 });
    });

    it("still refuses a person's command without a version when it is no set delta", async () => {
      const { store } = countingStore();

      await expect(executeCommand(delta(store, {}, 1), undefined, deps(technician))).rejects.toThrow(
        /needs the version/,
      );
    });

    it("refuses a set delta that names a version – it applies a change, not a state someone saw", async () => {
      const { store } = countingStore();

      await expect(executeCommand(delta(store, { setDelta: true }, 1, 3), undefined, deps(technician))).rejects.toThrow(
        /names no version/,
      );
    });

    it("ends successfully without saving or journaling when a set delta has nothing to do", async () => {
      const { store, seen } = countingStore();
      const nothing = delta(store, { setDelta: true }, 0);

      const outcome = await executeCommand(nothing, undefined, deps(technician));

      expect(outcome).toEqual({ ok: true, result: undefined });
      expect(seen.savedAt).toBeUndefined();
    });

    it("still refuses a changing command that journals nothing when it is no set delta", async () => {
      const { store } = countingStore();

      await expect(executeCommand(delta(store, {}, 0, 3), undefined, deps(technician))).rejects.toThrow(
        /journals no event/,
      );
    });

    it("lets a versioned command that may change nothing end without saving or journaling (HS-27)", async () => {
      const { store, seen } = countingStore();
      const nothing = delta(store, { mayChangeNothing: true }, 0, 3);

      expect(await executeCommand(nothing, undefined, deps(technician))).toEqual({ ok: true, result: undefined });
      expect(seen).toEqual({ lock: false, savedAt: undefined });
    });

    it("still checks the version when a command that may change nothing does change something", async () => {
      const { store, seen } = countingStore();

      await executeCommand(delta(store, { mayChangeNothing: true }, 1, 2), undefined, deps(technician));

      expect(seen.savedAt).toBe(2);
    });

    it("still has nothing to do with policies added – withPolicies keeps the set delta", async () => {
      const { store, seen } = countingStore();
      const nothing = withPolicies(delta(store, { setDelta: true }, 0), []);

      expect(await executeCommand(nothing, undefined, deps(technician))).toEqual({ ok: true, result: undefined });
      expect(seen.savedAt).toBeUndefined();
    });
  });

  it("hands a rejection's subjects to the caller – the IDs its decision names as the cause", async () => {
    const store: AggregateStore<{ id: string }> = {
      type: "AGG-Test",
      load: async (_tx, id) => ({ state: { id }, version: 1 }),
      insert: async () => {},
      update: async () => true,
    };
    const rejecting = aggregateCommand({
      id: "CMD-TestRejecting",
      allowedActors: ["technician"],
      store,
      target: () => ({ id: "x", version: 1 }),
      decide: () => ({ ok: false as const, error: "machine-retired" as const, subjects: ["lg-044"] }),
      journal: () => ({ type: "EVT-Never", aggregate: { type: "AGG-Test", id: "x" }, machineId: null, data: {} }),
      result: () => undefined,
    });

    expect(await executeCommand(rejecting, undefined, deps(technician))).toEqual({
      ok: false,
      error: "machine-retired",
      subjects: ["lg-044"],
    });
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
