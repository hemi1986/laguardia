import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { machineRecord } from "@/modules/collection";
import { problemReportsOfMachine } from "@/modules/repair";
import { reportAndChangeStatusForTest } from "@/modules/repair/problem-report-stand-ins.test-support";
import { fixedClock } from "@/platform/clock";
import { testDatabase } from "@/test-support/database";
import { aRegisteredMachine, journalSinceRegistration } from "@/test-support/machines";
import { anExistingTeamMember } from "@/test-support/team-members";
import { executeCommand, journalOf, type Actor } from ".";

/**
 * `context.run` (architecture review 2026-09-27, Q6; ST-018): a command runs another command – here Repair's stand-in
 * runs Collection's CMD-ChangeMachineStatus – in the same transaction, as the same acting person, with the inner
 * command's own authorization check.
 */
const db = testDatabase();
const clock = fixedClock("2026-10-03T18:00:00Z");
const technician = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;

async function museumNumberOf(machineId: string) {
  const [entry] = await journalOf(db, { machineId });
  return entry.data.museumNumber as string;
}

function reportAndChange(actor: Actor, machineId: string, reason = "ball stuck – unsafe") {
  return executeCommand(
    reportAndChangeStatusForTest,
    { machineId, description: "Ball stuck", machineVersion: 0, machineStatus: "out-of-order", reason },
    { actor, db, clock, newId: randomUUID },
  );
}

describe("context.run", () => {
  it("runs the inner command in the same transaction and journals both as the same acting person", async () => {
    await anExistingTeamMember(db, technician);
    const machineId = await aRegisteredMachine(db);

    expect((await reportAndChange(technician, machineId)).ok).toBe(true);

    expect((await journalSinceRegistration(db, machineId)).map((entry) => [entry.type, entry.actor])).toEqual([
      ["EVT-ProblemReported", technician],
      ["EVT-MachineStatusChanged", technician],
    ]);
    expect((await machineRecord(db, await museumNumberOf(machineId)))?.machineStatus).toBe("out-of-order");
  });

  it("makes the whole command not-authorized when the person may not run the inner command, storing nothing", async () => {
    const machineId = await aRegisteredMachine(db);

    // A visitor may report a problem, but not change a machine status.
    expect(await reportAndChange({ kind: "visitor" }, machineId)).toEqual({ ok: false, error: "not-authorized" });

    expect(await problemReportsOfMachine(db, machineId)).toEqual([]);
    expect(await journalSinceRegistration(db, machineId)).toEqual([]);
  });

  it("rejects the whole command with the inner command's reason and stores nothing", async () => {
    await anExistingTeamMember(db, technician);
    const machineId = await aRegisteredMachine(db);

    expect(await reportAndChange(technician, machineId, "  ")).toEqual({ ok: false, error: "reason-required" });

    expect(await problemReportsOfMachine(db, machineId)).toEqual([]);
    expect(await journalSinceRegistration(db, machineId)).toEqual([]);
    expect((await machineRecord(db, await museumNumberOf(machineId)))?.machineStatus).toBe("playable");
  });
});
