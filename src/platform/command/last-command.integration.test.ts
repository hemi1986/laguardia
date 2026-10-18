import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { changeMachineStatusCommand, moveMachineCommand } from "@/modules/collection";
import { reportProblemAndTriageCommand } from "@/modules/repair";
import { fixedClock } from "@/platform/clock";
import { testDatabase } from "@/test-support/database";
import { aRegisteredMachine } from "@/test-support/machines";
import { anExistingTeamMember } from "@/test-support/team-members";
import { executeCommand, lastCommandBy } from ".";

/**
 * What a page may confirm (G3, architecture review 2026-10-18): the events of the latest command on a machine or an
 * aggregate – only when the team member looking at the page ran it. Driven by real module commands.
 */
const db = testDatabase();
const anna = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;

const types = (entries: { type: string }[] | undefined) => entries?.map((entry) => entry.type);

async function changeStatus(actor: typeof anna, machineId: string, version: number, at: string) {
  const changed = await executeCommand(
    changeMachineStatusCommand,
    { machineId, version, machineStatus: "limited", reason: "test" },
    { actor, db, clock: fixedClock(at), newId: randomUUID },
  );
  if (!changed.ok) throw new Error(changed.error);
}

describe("the latest command on a target, if the team member ran it", () => {
  it("is what the team member just did on the machine – and nothing for anyone else", async () => {
    for (const member of [anna, tom]) await anExistingTeamMember(db, member);
    const machineId = await aRegisteredMachine(db);

    await changeStatus(anna, machineId, 0, "2026-10-18T10:00:00Z");

    expect(types(await lastCommandBy(db, { machineId }, anna.teamMemberId))).toEqual(["EVT-MachineStatusChanged"]);
    expect(await lastCommandBy(db, { machineId }, tom.teamMemberId)).toBeUndefined();
  });

  it("is nothing once someone else did something after it", async () => {
    for (const member of [anna, tom]) await anExistingTeamMember(db, member);
    const machineId = await aRegisteredMachine(db);
    await changeStatus(anna, machineId, 0, "2026-10-18T10:00:00Z");

    const moved = await executeCommand(
      moveMachineCommand,
      { machineId, version: 1, location: "Hall 3" },
      { actor: tom, db, clock: fixedClock("2026-10-18T10:01:00Z"), newId: randomUUID },
    );
    if (!moved.ok) throw new Error(moved.error);

    expect(await lastCommandBy(db, { machineId }, anna.teamMemberId)).toBeUndefined();
    expect(types(await lastCommandBy(db, { machineId }, tom.teamMemberId))).toEqual(["EVT-MachineMoved"]);
  });

  it("holds every event of that command, also those on other aggregates – a problem report triaged with a status change", async () => {
    await anExistingTeamMember(db, anna);
    const machineId = await aRegisteredMachine(db);

    const reported = await executeCommand(
      reportProblemAndTriageCommand,
      {
        machineId,
        description: "Left flipper dead",
        triage: {
          outcome: "defect-recorded",
          title: "Left flipper dead",
          priority: undefined,
          suitableForHelpers: false,
          machineStatus: "out-of-order",
          machineVersion: 0,
        },
      },
      { actor: anna, db, clock: fixedClock("2026-10-18T11:00:00Z"), newId: randomUUID },
    );
    if (!reported.ok) throw new Error(reported.error);

    expect(types(await lastCommandBy(db, { aggregateId: reported.result.problemReportId }, anna.teamMemberId))).toEqual(
      ["EVT-ProblemReported", "EVT-DefectRecorded", "EVT-MachineStatusChanged"],
    );
  });
});
