import { randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { fixedClock } from "@/platform/clock";
import { executeCommand, journalOf, type Actor } from "@/platform/command";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { anExistingTeamMember } from "@/test-support/team-members";
import { createMachineModelCommand, machineOverview, machineStatusHistory, registerMachineCommand } from ".";
import type { RegisterMachineInput } from ".";
import { withoutMachines } from "./machines.test-support";

/**
 * CMD-RegisterMachine through the command layer. The museum number is unique among all machines ever registered
 * (HS-17) – a rule over the whole set – so these tests run in a database of their own, emptied of machines before
 * each test: "the highest museum number is LG-041" can only be arranged there.
 */
const isolated = isolatedTestDatabase("register_machine");
let db: NodePgDatabase;
const eva: Actor = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" };
const clock = fixedClock("2026-10-01T10:00:00Z");
let medievalMadness: string;

beforeAll(async () => {
  db = await isolated.reset();
  await anExistingTeamMember(db, eva);
  const created = await executeCommand(
    createMachineModelCommand,
    { title: "Medieval Madness", manufacturer: "Williams", year: "1997", machineCategory: "pinball" },
    { actor: eva, db, clock, newId: randomUUID },
  );
  if (!created.ok) throw new Error(created.error);
  medievalMadness = created.result.machineModelId;
});

afterAll(() => isolated.close());

beforeEach(() => withoutMachines(db));

function register(input: Partial<RegisterMachineInput>, actor: Actor = eva) {
  return executeCommand(
    registerMachineCommand,
    {
      machineModelId: medievalMadness,
      museumNumber: undefined,
      serialNumber: undefined,
      location: "Hall 2, row 3",
      machineStatus: "playable",
      ...input,
    },
    { actor, db, clock, newId: randomUUID },
  );
}

async function registered(input: Partial<RegisterMachineInput>, actor: Actor = eva) {
  const outcome = await register(input, actor);
  if (!outcome.ok) throw new Error(outcome.error);
  return outcome.result;
}

async function overviewEntry(machineId: string) {
  return (await machineOverview(db)).find((machine) => machine.id === machineId);
}

describe("CMD-RegisterMachine", () => {
  it("ST-007: Technician registers a machine with an assigned museum number", async () => {
    await registered({ museumNumber: "LG-041" });

    const { machineId } = await registered({ location: "Hall 2, row 3", machineStatus: "playable" });

    expect(await overviewEntry(machineId)).toEqual({
      id: machineId,
      museumNumber: "LG-042",
      machineModelTitle: "Medieval Madness",
      location: "Hall 2, row 3",
      machineStatus: "playable",
    });
    expect(await machineStatusHistory(db, machineId)).toEqual([
      {
        previousStatus: undefined,
        newStatus: "playable",
        reason: "registration",
        changedBy: eva.kind === "team-member" ? eva.teamMemberId : undefined,
        changedAt: new Date("2026-10-01T10:00:00Z"),
      },
    ]);
    expect(await journalOf(db, { machineId })).toMatchObject([
      {
        type: "EVT-MachineRegistered",
        actor: eva,
        aggregate: { type: "AGG-Machine", id: machineId },
        data: { museumNumber: "LG-042", machineModelId: medievalMadness, machineStatus: "playable" },
      },
    ]);
  });
});
