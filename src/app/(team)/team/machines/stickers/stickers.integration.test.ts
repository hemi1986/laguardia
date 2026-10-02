import { randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createMachineModelCommand, registerMachineCommand } from "@/modules/collection";
import { retireMachineForTest, withoutMachines } from "@/modules/collection/machines.test-support";
import { executeCommand } from "@/platform/command";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { anExistingTeamMember } from "@/test-support/team-members";
import { machinesToPrintFor, stickersFor } from "./stickers-data";

/** Choosing machines for QR stickers and printing them (ST-011) – in a database of its own for "LG-013". */
const isolated = isolatedTestDatabase("stickers");
let db: NodePgDatabase;
const eva = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
let model: string;

beforeAll(async () => {
  db = await isolated.reset();
  await anExistingTeamMember(db, eva);
  const created = await executeCommand(
    createMachineModelCommand,
    { title: "Medieval Madness", manufacturer: "Williams", machineCategory: "pinball" },
    { actor: eva, db, newId: randomUUID },
  );
  if (!created.ok) throw new Error(created.error);
  model = created.result.machineModelId;
});

afterAll(() => isolated.close());

beforeEach(() => withoutMachines(db));

async function registered(museumNumber: string) {
  const outcome = await executeCommand(
    registerMachineCommand,
    { machineModelId: model, museumNumber, serialNumber: undefined, location: "Hall 1", machineStatus: "playable" },
    { actor: eva, db, newId: randomUUID },
  );
  if (!outcome.ok) throw new Error(outcome.error);
  return outcome.result.machineId;
}

describe("QR stickers", () => {
  it("ST-011: Retired machines get no sticker", async () => {
    await registered("LG-012");
    const retired = await registered("LG-013");
    await executeCommand(retireMachineForTest, { machineId: retired, version: 0 }, { actor: eva, db, newId: randomUUID });

    expect((await machinesToPrintFor(db, {})).map((machine) => machine.museumNumber)).toEqual(["LG-012"]);
    expect((await stickersFor(db, ["LG-012", "LG-013"])).map((sticker) => sticker.museumNumber)).toEqual(["LG-012"]);
  });

  it("prints only registered machines, each once, sorted by museum number", async () => {
    await registered("LG-002");
    await registered("LG-001");

    const stickers = await stickersFor(db, ["LG-002", "LG-999", "LG-001", "LG-002"]);

    expect(stickers.map((sticker) => sticker.museumNumber)).toEqual(["LG-001", "LG-002"]);
    expect(stickers[0].qrCode).toMatch(/^data:image\/png;base64,/);
  });
});
