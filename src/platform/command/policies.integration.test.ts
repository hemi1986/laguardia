import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { problemReportsOfMachine, reportProblemCommand } from "@/modules/repair";
import {
  changeDescriptionForTest,
  policyForTest,
  reportWithIdlePolicyForTest,
} from "@/modules/repair/command-probes.test-support";
import { fixedClock } from "@/platform/clock";
import { testDatabase } from "@/test-support/database";
import { aRegisteredMachine, journalSinceRegistration } from "@/test-support/machines";
import { anExistingTeamMember } from "@/test-support/team-members";
import {
  executeCommand,
  policy,
  run,
  trigger,
  withPolicies,
  withPolicyInput,
  type Actor,
  type Command,
  type JournalEvent,
} from ".";

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

/** A policy that changes the reported problem report as the person who reported it – to the given description. */
const changesAsReporter = (description: string) =>
  policy({
    id: "POL-TestChangesAsReporter",
    calls: async (_tx, { events }) =>
      events
        .filter((event) => event.type === "EVT-ProblemReported")
        .map((event) =>
          run(changeDescriptionForTest, { problemReportId: event.aggregate.id, version: 0, description }),
        ),
  });

describe("a policy that runs a command as the acting person", () => {
  const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;

  it("runs it as the person who ran the triggering command, journaled with them", async () => {
    await anExistingTeamMember(db, tom, "Tom");
    const machineId = await aRegisteredMachine(db);
    // A technician reporting without triage: the probe of Repair (its own policy does nothing here).
    const command = withPolicies(reportWithIdlePolicyForTest, [changesAsReporter("Ball stuck in the trough")]);

    const outcome = await executeCommand(
      command,
      { machineId, description: "Ball stuck" },
      { actor: tom, db, clock, newId: randomUUID },
    );

    expect(outcome).toMatchObject({ ok: true });
    expect((await problemReportsOfMachine(db, machineId)).map((report) => report.description)).toEqual([
      "Ball stuck in the trough",
    ]);
    expect(
      (await journalSinceRegistration(db, machineId)).map((entry) => [
        entry.type,
        entry.actor.kind === "team-member" && entry.actor.teamMemberId,
      ]),
    ).toEqual([
      ["EVT-ProblemReported", tom.teamMemberId],
      ["EVT-TestDescriptionChanged", tom.teamMemberId],
    ]);
  });

  it("a person the command of the policy does not allow rejects the whole command", async () => {
    const machineId = await aRegisteredMachine(db);
    const command = withPolicies(reportProblemCommand, [changesAsReporter("Ball stuck in the trough")]);

    expect(await report(command, machineId)).toEqual({ ok: false, error: "not-authorized" });
    expect(await problemReportsOfMachine(db, machineId)).toEqual([]);
  });
});

describe("withPolicyInput", () => {
  const eva = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;

  it("binds the policies to the step's own input; the command gets only its part", async () => {
    await anExistingTeamMember(db, eva, "Eva");
    const machineId = await aRegisteredMachine(db);
    const command = withPolicyInput(reportWithIdlePolicyForTest, (input: { description: string }) => [
      changesAsReporter(input.description),
    ]);

    expect(command.id).toBe("CMD-TestReportWithIdlePolicy");
    const outcome = await executeCommand(
      command,
      { command: { machineId, description: "Ball stuck" }, policies: { description: "Flipper weak" } },
      { actor: eva, db, clock, newId: randomUUID },
    );

    expect(outcome).toMatchObject({ ok: true });
    expect((await problemReportsOfMachine(db, machineId)).map((report) => report.description)).toEqual([
      "Flipper weak",
    ]);
  });
});
