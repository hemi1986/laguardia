import { randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { fixedClock } from "@/platform/clock";
import { executeCommand, journalOf, type Actor } from "@/platform/command";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { anExistingTeamMember } from "@/test-support/team-members";
import { createMachineModelCommand, machineOverview, registerMachineCommand } from ".";
import { machineStatusHistory } from "./machines";
import type { RegisterMachineInput } from ".";
import {
  changeMachineStatusForTest,
  correctMuseumNumberForTest,
  retireMachineForTest,
  storedMachine,
  withoutMachines,
} from "./machines.test-support";

/**
 * CMD-RegisterMachine through the command layer. The museum number is unique among all machines ever registered
 * (HS-17) – a rule over the whole set – so these tests run in a database of their own, emptied of machines before
 * each test: "the highest museum number is LG-041" can only be arranged there.
 */
const isolated = isolatedTestDatabase("register_machine");
let db: NodePgDatabase;
const eva = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;
const clock = fixedClock("2026-10-01T10:00:00Z");
let medievalMadness: string;

beforeAll(async () => {
  db = await isolated.reset();
  await anExistingTeamMember(db, eva);
  await anExistingTeamMember(db, tom);
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

async function museumNumberOf(machineId: string) {
  return (await overviewEntry(machineId))?.museumNumber;
}

const asTechnician = { actor: eva, clock, newId: randomUUID };

async function retire(machineId: string) {
  const retired = await executeCommand(retireMachineForTest, { machineId, version: 0 }, { ...asTechnician, db });
  if (!retired.ok) throw new Error("not retired");
}

async function correctMuseumNumber(machineId: string, museumNumber: string) {
  const corrected = await executeCommand(
    correctMuseumNumberForTest,
    { machineId, version: 0, museumNumber },
    { ...asTechnician, db },
  );
  if (!corrected.ok) throw new Error("not corrected");
}

/** LG-001 to LG-999 given out, except LG-017 – through the command, one registration each. */
async function usedExceptLG017() {
  for (let number = 1; number <= 999; number++) {
    if (number !== 17) await registered({ museumNumber: `LG-${String(number).padStart(3, "0")}` });
  }
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
      machineCategory: "pinball",
      technology: undefined,
      location: "Hall 2, row 3",
      machineStatus: "playable",
    });
    expect(await machineStatusHistory(db, machineId)).toEqual([
      {
        id: expect.any(String),
        previousStatus: undefined,
        newStatus: "playable",
        reason: "registration",
        changedBy: eva.teamMemberId,
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

  it("ST-007: Technician gives the museum number", async () => {
    const { machineId } = await registered({ museumNumber: "LG-007", serialNumber: "MM-12345" });

    expect(await museumNumberOf(machineId)).toBe("LG-007");
    const [registration] = await journalOf(db, { machineId });
    expect(registration.data).toEqual({
      museumNumber: "LG-007",
      machineModelId: medievalMadness,
      machineStatus: "playable",
    });
    expect((await storedMachine(db, machineId))?.serialNumber).toBe("MM-12345"); // no read model shows it before ST-009
  });

  it("ST-007: Museum number of a retired machine is never reused", async () => {
    const { machineId: retired } = await registered({ museumNumber: "LG-050" });
    await registered({ museumNumber: "LG-012" });
    await retire(retired);

    const { machineId } = await registered({});

    expect(await museumNumberOf(machineId)).toBe("LG-051");
  });

  it("ST-007: Reserved museum numbers count", async () => {
    await registered({ museumNumber: "LG-041" });
    const { machineId: corrected } = await registered({ museumNumber: "LG-045" });
    await correctMuseumNumber(corrected, "LG-040");

    const { machineId } = await registered({});

    expect(await museumNumberOf(machineId)).toBe("LG-046");
  });

  it("ST-007: After LG-999 the next free lower number is used", { timeout: 60_000 }, async () => {
    await usedExceptLG017(); // 998 registrations through the command – seconds, not the default 5

    const { machineId } = await registered({});

    expect(await museumNumberOf(machineId)).toBe("LG-017");
  });

  it("ST-007: Concurrent automatic assignment", async () => {
    await registered({ museumNumber: "LG-041" });

    // Eight at once, one connection each, so they really overlap (two often run one after the other).
    const all = await Promise.all(Array.from({ length: 8 }, () => registered({})));

    expect((await Promise.all(all.map(({ machineId }) => museumNumberOf(machineId)))).sort()).toEqual([
      "LG-042",
      "LG-043",
      "LG-044",
      "LG-045",
      "LG-046",
      "LG-047",
      "LG-048",
      "LG-049",
    ]);
  });

  it("ST-007: Duplicate museum number is rejected", async () => {
    await registered({ museumNumber: "LG-007" });
    const { machineId: retired } = await registered({ museumNumber: "LG-008" });
    await retire(retired);
    const { machineId: corrected } = await registered({ museumNumber: "LG-009" });
    await correctMuseumNumber(corrected, "LG-010");

    for (const museumNumber of ["LG-007", "LG-008", "LG-009"]) {
      expect(await register({ museumNumber })).toEqual({ ok: false, error: "museum-number-taken" });
    }
    expect((await machineOverview(db)).map((machine) => machine.museumNumber)).toEqual(["LG-007", "LG-010"]);
  });

  it("ST-007: Museum number in another format is rejected", async () => {
    expect(await register({ museumNumber: "42" })).toEqual({ ok: false, error: "museum-number-format" });
    expect(await machineOverview(db)).toEqual([]);
  });

  it("ST-007: Concurrent registrations with the same museum number", async () => {
    // Eight at once, so they really overlap: exactly one wins, every other one is told why.
    const all = await Promise.all(Array.from({ length: 8 }, () => register({ museumNumber: "LG-060" })));

    expect(all.filter((outcome) => outcome.ok)).toHaveLength(1);
    expect(all.filter((outcome) => !outcome.ok)).toEqual(
      Array.from({ length: 7 }, () => ({ ok: false, error: "museum-number-taken" })),
    );
    expect((await machineOverview(db)).map((machine) => machine.museumNumber)).toEqual(["LG-060"]);
  });

  it("ST-007: Machine model and location are required", async () => {
    expect(await register({ machineModelId: undefined })).toEqual({ ok: false, error: "machine-model-required" });
    expect(await register({ machineModelId: randomUUID() })).toEqual({ ok: false, error: "machine-model-required" });
    expect(await register({ location: "   " })).toEqual({ ok: false, error: "location-required" });
    expect(await machineOverview(db)).toEqual([]);
  });

  it("ST-007: Helpers cannot register machines", async () => {
    expect(await register({ museumNumber: "LG-001" }, tom)).toEqual({ ok: false, error: "not-authorized" });
    expect(await machineOverview(db)).toEqual([]);
  });

  it("keeps the status history in the order it was recorded, also within one point in time", async () => {
    const { machineId } = await registered({ machineStatus: "playable" });
    const changed = await executeCommand(
      changeMachineStatusForTest,
      { machineId, version: 0, machineStatus: "out-of-order" },
      { ...asTechnician, db },
    );
    if (!changed.ok) throw new Error("not changed");

    expect((await machineStatusHistory(db, machineId)).map((change) => change.newStatus)).toEqual([
      "playable",
      "out-of-order",
    ]);
  });
});
