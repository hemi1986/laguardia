import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { executeCommand } from "@/platform/command";
import { testDatabase } from "@/test-support/database";
import { anExistingTeamMember } from "@/test-support/team-members";
import { createMachineModelCommand, machineModelForTeam, registerMachineCommand } from ".";
import { retireMachineCommand } from "./retire-machine-command";

/** The machine model as its page and its correction form show it (ST-036), set up through the commands. */
const db = testDatabase();
const eva = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const deps = { actor: eva, db, newId: randomUUID };

beforeAll(() => anExistingTeamMember(db, eva));

async function aMachineModel() {
  const created = await executeCommand(
    createMachineModelCommand,
    { title: "Medieval Madness", manufacturer: "Williams", year: "1997", machineCategory: "pinball" },
    deps,
  );
  if (!created.ok) throw new Error(created.error);
  return created.result.machineModelId;
}

async function aMachineOf(machineModelId: string) {
  const registered = await executeCommand(
    registerMachineCommand,
    { machineModelId, museumNumber: undefined, serialNumber: undefined, location: "Hall 2", machineStatus: "playable" },
    deps,
  );
  if (!registered.ok) throw new Error(registered.error);
  return registered.result.machineId;
}

describe("machineModelForTeam", () => {
  it("counts all machines of the model, retired ones included (user, 2026-10-18)", async () => {
    const machineModelId = await aMachineModel();
    await aMachineOf(machineModelId);
    await aMachineOf(machineModelId);
    const sold = await aMachineOf(machineModelId);
    const retired = await executeCommand(retireMachineCommand, { machineId: sold, version: 0, reason: "Sold" }, deps);
    if (!retired.ok) throw new Error(retired.error);

    expect(await machineModelForTeam(db, machineModelId)).toEqual({
      model: {
        id: machineModelId,
        title: "Medieval Madness",
        manufacturer: "Williams",
        year: 1997,
        machineCategory: "pinball",
        technology: undefined,
      },
      version: 0,
      machineCount: 3,
    });
  });

  it("knows no machine model for an unknown ID or an address that is no ID", async () => {
    expect(await machineModelForTeam(db, randomUUID())).toBeUndefined();
    expect(await machineModelForTeam(db, "medieval-madness")).toBeUndefined();
  });
});
