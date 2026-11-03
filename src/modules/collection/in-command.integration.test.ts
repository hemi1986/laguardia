import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { fixedClock } from "@/platform/clock";
import { aFileAdded } from "@/test-support/files";
import { executeCommand, lastCommandBy } from "@/platform/command";
import { testDatabase } from "@/test-support/database";
import { anExistingTeamMember } from "@/test-support/team-members";
import {
  correctMachineModelCommand,
  createMachineModelCommand,
  fileAddedIn,
  machineModelChangeIn,
  machineRegisteredIn,
  registerMachineCommand,
} from ".";

/**
 * What one command did in Collection (G3, architecture review 2026-10-18): asked of the events `lastCommandBy` returns,
 * typed by Collection's own event catalogue – the questions the pages' confirmations ask.
 */
const db = testDatabase();
const eva = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const at = { db, clock: fixedClock("2026-10-18T13:00:00Z"), newId: randomUUID };

describe("what a command did in Collection", () => {
  it("created, corrected and registered – each only for its own aggregate", async () => {
    await anExistingTeamMember(db, eva);
    const created = await executeCommand(
      createMachineModelCommand,
      { title: `Twilight Zone ${randomUUID().slice(0, 6)}`, manufacturer: "Bally", machineCategory: "pinball" },
      { actor: eva, ...at },
    );
    if (!created.ok) throw new Error(created.error);
    const modelId = created.result.machineModelId;
    expect(
      machineModelChangeIn((await lastCommandBy(db, { aggregateId: modelId }, eva.teamMemberId))!, modelId),
    ).toEqual({
      created: true,
      corrected: false,
    });

    const corrected = await executeCommand(
      correctMachineModelCommand,
      {
        machineModelId: modelId,
        version: 0,
        title: "Twilight Zone",
        manufacturer: "Bally",
        year: "1993",
        machineCategory: "pinball",
      },
      { actor: eva, ...at },
    );
    if (!corrected.ok) throw new Error(corrected.error);
    expect(
      machineModelChangeIn((await lastCommandBy(db, { aggregateId: modelId }, eva.teamMemberId))!, modelId),
    ).toEqual({
      created: false,
      corrected: true,
    });

    const registered = await executeCommand(
      registerMachineCommand,
      {
        machineModelId: modelId,
        museumNumber: undefined,
        serialNumber: undefined,
        location: "Hall 1",
        machineStatus: "playable",
      },
      { actor: eva, ...at },
    );
    if (!registered.ok) throw new Error(registered.error);
    const { machineId } = registered.result;
    const registering = (await lastCommandBy(db, { aggregateId: machineId }, eva.teamMemberId))!;
    expect(machineRegisteredIn(registering, machineId)).toBe(true);
    expect(machineRegisteredIn(registering, randomUUID())).toBe(false);

    const fileId = await aFileAdded(
      db,
      { actor: eva, clock: at.clock },
      { machineId, title: "Wiring", fileCategory: "schematic" },
    );
    const attaching = (await lastCommandBy(db, { aggregateId: fileId }, eva.teamMemberId))!;
    expect(fileAddedIn(attaching, fileId)).toBe(true);
    expect(fileAddedIn(registering, fileId)).toBe(false);
  });
});
