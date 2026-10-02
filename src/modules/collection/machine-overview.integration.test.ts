import { randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { fixedClock } from "@/platform/clock";
import { executeCommand } from "@/platform/command";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { anExistingTeamMember } from "@/test-support/team-members";
import { createMachineModelCommand, machineOverview, registerMachineCommand, type RegisterMachineInput } from ".";
import { retireMachineForTest, withoutMachines } from "./machines.test-support";

/**
 * RM-MachineOverview as ST-007 builds it: a plain list of the active machines. Its own database – the overview is
 * the list of all machines, so a test can only say what it contains when no other test registers machines there.
 */
const isolated = isolatedTestDatabase("machine_overview");
let db: NodePgDatabase;
const eva = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const asEva = () => ({ actor: eva, db, clock: fixedClock("2026-10-01T10:00:00Z"), newId: randomUUID });
let medievalMadness: string;
let galaxian: string;

async function machineModel(input: Parameters<typeof createMachineModelCommand.run>[0]) {
  const created = await executeCommand(createMachineModelCommand, input, asEva());
  if (!created.ok) throw new Error(created.error);
  return created.result.machineModelId;
}

beforeAll(async () => {
  db = await isolated.reset();
  await anExistingTeamMember(db, eva);
  medievalMadness = await machineModel({
    title: "Medieval Madness",
    manufacturer: "Williams",
    machineCategory: "pinball",
    technology: "dmd",
  });
  galaxian = await machineModel({ title: "Galaxian", manufacturer: "Namco", machineCategory: "arcade", technology: "crt" });
});

afterAll(() => isolated.close());

beforeEach(() => withoutMachines(db));

async function registered(
  input: Pick<RegisterMachineInput, "museumNumber" | "location" | "machineStatus"> & { machineModelId?: string },
) {
  const outcome = await executeCommand(
    registerMachineCommand,
    { machineModelId: medievalMadness, serialNumber: undefined, ...input },
    asEva(),
  );
  if (!outcome.ok) throw new Error(outcome.error);
  return outcome.result.machineId;
}

describe("RM-MachineOverview", () => {
  it("ST-007: The machine overview lists the registered machines", async () => {
    const second = await registered({ museumNumber: "LG-002", location: "Hall 2, row 1", machineStatus: "out-of-order" });
    const first = await registered({ museumNumber: "LG-001", location: "Hall 1, row 3", machineStatus: "playable" });

    expect(await machineOverview(db)).toEqual([
      { id: first, museumNumber: "LG-001", machineModelTitle: "Medieval Madness", machineCategory: "pinball", technology: "dmd", location: "Hall 1, row 3", machineStatus: "playable" },
      { id: second, museumNumber: "LG-002", machineModelTitle: "Medieval Madness", machineCategory: "pinball", technology: "dmd", location: "Hall 2, row 1", machineStatus: "out-of-order" },
    ]);
  });

  it("ST-008: Team member sees all active machines", async () => {
    const second = await registered({
      museumNumber: "LG-002",
      machineModelId: galaxian,
      location: "Hall 2, row 1",
      machineStatus: "out-of-order",
    });
    const first = await registered({ museumNumber: "LG-001", location: "Hall 1, row 3", machineStatus: "playable" });

    expect(await machineOverview(db)).toEqual([
      {
        id: first,
        museumNumber: "LG-001",
        machineModelTitle: "Medieval Madness",
        machineCategory: "pinball",
        technology: "dmd",
        location: "Hall 1, row 3",
        machineStatus: "playable",
      },
      {
        id: second,
        museumNumber: "LG-002",
        machineModelTitle: "Galaxian",
        machineCategory: "arcade",
        technology: "crt",
        location: "Hall 2, row 1",
        machineStatus: "out-of-order",
      },
    ]);
  });

  it("leaves retired machines out – the overview lists the active machines", async () => {
    const retired = await registered({ museumNumber: "LG-003", location: "Depot", machineStatus: "not-on-display" });
    await executeCommand(retireMachineForTest, { machineId: retired, version: 0 }, asEva());

    expect(await machineOverview(db)).toEqual([]);
  });
});
