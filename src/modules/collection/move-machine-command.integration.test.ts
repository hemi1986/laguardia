import { randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { fixedClock } from "@/platform/clock";
import { executeCommand, journalOf } from "@/platform/command";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { anExistingTeamMember } from "@/test-support/team-members";
import {
  createMachineModelCommand,
  machineOverview,
  machineRecord,
  moveMachineCommand,
  registerMachineCommand,
} from ".";
import { retireMachineForTest, withoutMachines } from "./machines.test-support";

/**
 * CMD-MoveMachine (ST-034) through the command layer, observed through the machine record, the machine overview and
 * the journal. In a database of its own, so "LG-042" can be arranged.
 */
const isolated = isolatedTestDatabase("move_machine");
let db: NodePgDatabase;
const eva = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const anna = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;
let machineModelId: string;

beforeAll(async () => {
  db = await isolated.reset();
  for (const member of [eva, anna]) await anExistingTeamMember(db, member);
  const created = await executeCommand(
    createMachineModelCommand,
    { title: "Medieval Madness", manufacturer: "Williams", machineCategory: "pinball" },
    { actor: eva, db, newId: randomUUID },
  );
  if (!created.ok) throw new Error(created.error);
  machineModelId = created.result.machineModelId;
});

afterAll(() => isolated.close());

beforeEach(() => withoutMachines(db));

const at = () => ({ db, clock: fixedClock("2026-03-02T14:00:00Z"), newId: randomUUID });

async function standingAt(museumNumber: string, location: string) {
  const outcome = await executeCommand(
    registerMachineCommand,
    { machineModelId, museumNumber, serialNumber: undefined, location, machineStatus: "playable" },
    { actor: eva, db, clock: fixedClock("2026-01-15T09:00:00Z"), newId: randomUUID },
  );
  if (!outcome.ok) throw new Error(outcome.error);
  return outcome.result.machineId;
}

const move = (machineId: string, location: string, actor: typeof eva | typeof anna = anna, version = 0) =>
  executeCommand(moveMachineCommand, { machineId, version, location }, { actor, ...at() });

describe("CMD-MoveMachine", () => {
  it("a helper moves a machine – the journal names the machine and who moved it, not the location", async () => {
    const machineId = await standingAt("LG-042", "Hall 2, row 3");

    const outcome = await move(machineId, "  Workshop ");

    expect(outcome).toEqual({ ok: true, result: { museumNumber: "LG-042", location: "Workshop" } });
    expect((await machineRecord(db, "LG-042"))?.location).toBe("Workshop");
    const overview = await machineOverview(db);
    expect(overview.find((entry) => entry.museumNumber === "LG-042")?.location).toBe("Workshop");
    const [, moved] = await journalOf(db, { machineId });
    // A location is typed text – it stays in the aggregate (ST-003).
    expect(moved).toMatchObject({
      type: "EVT-MachineMoved",
      actor: anna,
      aggregate: { type: "AGG-Machine", id: machineId },
    });
    expect(moved.data).toEqual({});
  });

  it("ST-034: Location is required", async () => {
    const machineId = await standingAt("LG-042", "Hall 2, row 3");

    for (const location of ["", "   "]) {
      expect(await move(machineId, location)).toEqual({ ok: false, error: "location-required" });
    }

    expect((await machineRecord(db, "LG-042"))?.location).toBe("Hall 2, row 3");
    expect(await journalOf(db, { machineId })).toHaveLength(1);
  });

  it("ST-034: Retired machines cannot be moved", async () => {
    const machineId = await standingAt("LG-013", "Hall 1");
    const retired = await executeCommand(retireMachineForTest, { machineId, version: 0 }, { actor: eva, ...at() });
    if (!retired.ok) throw new Error(retired.error);

    expect(await move(machineId, "Storage", eva, 1)).toEqual({ ok: false, error: "machine-retired" });
    expect((await machineRecord(db, "LG-013"))?.location).toBe("Hall 1");
  });

  it("the location the machine already has is rejected – no change without a change (user, 2026-10-18)", async () => {
    const machineId = await standingAt("LG-042", "Workshop");

    expect(await move(machineId, " Workshop ")).toEqual({ ok: false, error: "location-unchanged" });
    expect(await journalOf(db, { machineId })).toHaveLength(1);
  });
});
