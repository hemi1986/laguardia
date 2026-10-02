import { randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { fixedClock } from "@/platform/clock";
import { executeCommand } from "@/platform/command";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { anExistingTeamMember } from "@/test-support/team-members";
import {
  createMachineModelCommand,
  machineOverview,
  machineStatusCounts,
  registerMachineCommand,
  type MachineStatus,
  type RegisterMachineInput,
} from ".";
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

  it("ST-008: Number of machines per machine status", async () => {
    const statuses: [MachineStatus, number][] = [
      ["playable", 45],
      ["limited", 6],
      ["out-of-order", 3],
      ["not-on-display", 5],
    ];
    for (const [machineStatus, count] of statuses) {
      for (let i = 0; i < count; i++) await registered({ museumNumber: undefined, location: "Hall 1", machineStatus });
    }

    expect(await machineStatusCounts(db)).toEqual({
      playable: 45,
      limited: 6,
      "out-of-order": 3,
      "not-on-display": 5,
    });
  });

  it("ST-008: Filter by machine status", async () => {
    for (const museumNumber of ["LG-001", "LG-003", "LG-004"]) {
      await registered({ museumNumber, location: "Hall 1", machineStatus: "playable" });
    }
    for (const museumNumber of ["LG-002", "LG-007"]) {
      await registered({ museumNumber, location: "Hall 1", machineStatus: "out-of-order" });
    }

    expect(museumNumbers(await machineOverview(db, { machineStatus: "out-of-order" }))).toEqual(["LG-002", "LG-007"]);
  });

  it("ST-008: Search by museum number", async () => {
    await registered({ museumNumber: "LG-042", location: "Hall 2, row 3", machineStatus: "playable" });
    await registered({ museumNumber: "LG-142", machineModelId: galaxian, location: "Hall 1", machineStatus: "playable" });
    await registered({ museumNumber: "LG-001", location: "Hall 1", machineStatus: "playable" });

    expect(museumNumbers(await machineOverview(db, { search: "042" }))).toEqual(["LG-042"]);
  });

  it("ST-008: Search by title", async () => {
    await registered({ museumNumber: "LG-042", location: "Hall 2, row 3", machineStatus: "playable" });
    await registered({ museumNumber: "LG-043", machineModelId: galaxian, location: "Hall 1", machineStatus: "playable" });

    expect(museumNumbers(await machineOverview(db, { search: "medieval" }))).toEqual(["LG-042"]);
  });

  it("combines the search with the machine status filter", async () => {
    await registered({ museumNumber: "LG-042", location: "Hall 2", machineStatus: "playable" });
    await registered({ museumNumber: "LG-043", location: "Hall 2", machineStatus: "out-of-order" });
    await registered({ museumNumber: "LG-044", machineModelId: galaxian, location: "Hall 1", machineStatus: "out-of-order" });

    const found = await machineOverview(db, { search: "Medieval", machineStatus: "out-of-order" });

    expect(museumNumbers(found)).toEqual(["LG-043"]);
  });

  it("ST-008: Retired machines are not listed", async () => {
    await registered({ museumNumber: "LG-012", location: "Hall 1", machineStatus: "playable" });
    const retired = await registered({ museumNumber: "LG-013", location: "Depot", machineStatus: "playable" });
    await executeCommand(retireMachineForTest, { machineId: retired, version: 0 }, asEva());

    expect(museumNumbers(await machineOverview(db))).toEqual(["LG-012"]);
    expect(museumNumbers(await machineOverview(db, { search: "013" }))).toEqual([]);
    expect((await machineStatusCounts(db)).playable).toBe(1);
  });
});

function museumNumbers(machines: { museumNumber: string }[]): string[] {
  return machines.map((machine) => machine.museumNumber);
}
