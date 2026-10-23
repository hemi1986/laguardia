import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { problemReportsOfMachine, reportProblemCommand } from "@/modules/repair";
import { policyForTest } from "@/modules/repair/command-probes.test-support";
import { fixedClock } from "@/platform/clock";
import { testDatabase } from "@/test-support/database";
import { aRegisteredMachine, journalSinceRegistration } from "@/test-support/machines";
import { executeCommand, policy, trigger, withPolicies, type Actor, type Command, type JournalEvent } from ".";

/**
 * `withPolicies` (ADR 0010, ST-039): another module adds its automatic policies to a command. They see the command's
 * journal events and who ran it, run as the system in the same transaction, and a rejected one rejects everything.
 * Here Repair's real CMD-ReportProblem triggers the stand-in policy of the command probes.
 */
const db = testDatabase();
const clock = fixedClock("2026-10-23T18:00:00Z");
const visitor = { kind: "visitor" } as const;

/** A policy on every reported problem report – rejecting on request – that remembers what it was given. */
function onReported(seen: { events: readonly JournalEvent[]; actor: Actor }[], options: { reject?: boolean } = {}) {
  return policy({
    id: "POL-TestOnReported",
    calls: async (_tx, triggered) => {
      seen.push(triggered);
      return triggered.events
        .filter((event) => event.type === "EVT-ProblemReported")
        .map((event) => trigger(policyForTest, { problemReportId: event.aggregate.id, ...options }));
    },
  });
}

/** A visitor's problem report through the given command – CMD-ReportProblem with policies added. */
const report = <Error extends string>(
  command: Command<{ machineId: string; description: string }, unknown, Error>,
  machineId: string,
  description = "Ball stuck",
) => executeCommand(command, { machineId, description }, { actor: visitor, db, clock, newId: randomUUID });

describe("withPolicies", () => {
  it("runs the added policies after the command, as the system, with the command's events and its acting person", async () => {
    const machineId = await aRegisteredMachine(db);
    const seen: { events: readonly JournalEvent[]; actor: Actor }[] = [];
    const command = withPolicies(reportProblemCommand, [onReported(seen)]);

    expect(command.id).toBe("CMD-ReportProblem");
    expect((await report(command, machineId)).ok).toBe(true);

    expect(seen).toHaveLength(1);
    expect(seen[0].actor).toEqual(visitor);
    expect(seen[0].events.map((event) => event.type)).toEqual(["EVT-ProblemReported"]);
    expect((await journalSinceRegistration(db, machineId)).map((entry) => [entry.type, entry.actor.kind])).toEqual([
      ["EVT-ProblemReported", "visitor"],
      ["EVT-TestPolicyApplied", "system"],
    ]);
  });

  it("a rejected policy rejects the whole command – nothing is stored or journaled", async () => {
    const machineId = await aRegisteredMachine(db);
    const command = withPolicies(reportProblemCommand, [onReported([], { reject: true })]);

    expect(await report(command, machineId)).toEqual({ ok: false, error: "policy-rejected" });

    expect(await problemReportsOfMachine(db, machineId)).toEqual([]);
    expect(await journalSinceRegistration(db, machineId)).toEqual([]);
  });

  it("a rejected command runs no policy", async () => {
    const machineId = await aRegisteredMachine(db);
    const seen: { events: readonly JournalEvent[]; actor: Actor }[] = [];
    const command = withPolicies(reportProblemCommand, [onReported(seen)]);

    expect(await report(command, machineId, "  ")).toEqual({ ok: false, error: "description-required" });
    expect(seen).toEqual([]);
  });
});
