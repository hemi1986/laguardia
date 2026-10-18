import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { changeMachineStatusCommand, moveMachineCommand } from "@/modules/collection";
import { reportProblemCommand } from "@/modules/repair";
import { fixedClock } from "@/platform/clock";
import { executeCommand } from "@/platform/command";
import { testDatabase } from "@/test-support/database";
import { aRegisteredMachine } from "@/test-support/machines";
import { anExistingTeamMember } from "@/test-support/team-members";
import { loadMachineConfirmation } from "./machine-confirmation";

/**
 * What the machine record confirms (G3, architecture review 2026-10-18): `?statusChanged`, `?moved` and
 * `?problemReported` only name what to look for – the latest command on the machine must be that action, run by the
 * team member looking at the page. Before, the page believed the address.
 */
const db = testDatabase();
const clock = fixedClock("2026-10-18T12:00:00Z");
const anna = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;

const confirmationOf = (machineId: string, query: Record<string, string>, viewer = anna.teamMemberId) =>
  loadMachineConfirmation(db, clock, viewer, { id: machineId, files: [] }, query);

describe("the machine record's confirmation", () => {
  it("confirms a move, a status change and a problem report to the team member who just did it", async () => {
    for (const member of [anna, tom]) await anExistingTeamMember(db, member);
    const machineId = await aRegisteredMachine(db);
    const at = { db, clock, newId: randomUUID };

    await executeCommand(moveMachineCommand, { machineId, version: 0, location: "Hall 3" }, { actor: anna, ...at });
    expect(await confirmationOf(machineId, { moved: "1" })).toEqual({ kind: "moved" });

    await executeCommand(
      changeMachineStatusCommand,
      { machineId, version: 1, machineStatus: "out-of-order", reason: "Dead" },
      { actor: anna, ...at },
    );
    expect(await confirmationOf(machineId, { statusChanged: "1" })).toEqual({ kind: "status-changed" });

    await executeCommand(reportProblemCommand, { machineId, description: "Display dark" }, { actor: anna, ...at });
    expect(await confirmationOf(machineId, { problemReported: "1" })).toEqual({ kind: "problem-reported" });
  });

  it("confirms nothing the address only claims – to someone else, or for another action", async () => {
    for (const member of [anna, tom]) await anExistingTeamMember(db, member);
    const machineId = await aRegisteredMachine(db);
    await executeCommand(
      moveMachineCommand,
      { machineId, version: 0, location: "Hall 3" },
      { actor: anna, db, clock, newId: randomUUID },
    );

    expect(await confirmationOf(machineId, { moved: "1" }, tom.teamMemberId)).toBeUndefined();
    expect(await confirmationOf(machineId, { statusChanged: "1" })).toBeUndefined();
    expect(await confirmationOf(machineId, { problemReported: "1" })).toBeUndefined();
    expect(await confirmationOf(machineId, { attached: randomUUID() })).toBeUndefined();
    expect(await confirmationOf(await aRegisteredMachine(db), { moved: "1" })).toBeUndefined();
  });
});
