import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { fixedClock } from "@/platform/clock";
import { aggregateCommand, executeCommand } from "@/platform/command";
import { whileHoldingRow } from "@/test-support/held-row";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { anExistingTeamMember } from "@/test-support/team-members";
import {
  correctMachineDetailsCommand,
  createMachineModelCommand,
  machineForTeamForm,
  moveMachineCommand,
  registerMachineCommand,
} from ".";
import { machines } from "./machines";
import { withoutMachines } from "./machines.test-support";
import { machineOfMuseumNumber } from "./museum-numbers";

/**
 * The museum number register (ST-035): every write of a museum number runs under its lock and a unique violation is
 * `museum-number-taken` – also for a command that forgets to read its facts. Such a command is a probe below; no real
 * command writes a museum number without the register's facts.
 */
const isolated = isolatedTestDatabase("museum_numbers");
let db: NodePgDatabase;
const eva = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const clock = fixedClock("2026-10-25T10:00:00Z");
let medievalMadness: string;

/** A command that gives a machine a museum number without reading any facts – what the register must still guard. */
const museumNumberWithoutFacts = aggregateCommand({
  id: "CMD-TestMuseumNumberWithoutFacts",
  allowedActors: ["technician"],
  store: machines,
  target: (input: { machineId: string; version: number; museumNumber: string }) => ({
    id: input.machineId,
    version: input.version,
  }),
  decide: (machine, input) => ({
    ok: true as const,
    state: { ...machine, museumNumber: input.museumNumber },
    events: [{ type: "EVT-TestMuseumNumberWritten" as const }],
  }),
  journal: (event, machine) => ({
    type: event.type,
    aggregate: { type: "AGG-Machine", id: machine.id },
    machineId: machine.id,
    data: {},
  }),
  result: () => ({}),
});

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

const asEva = () => ({ actor: eva, db, clock, newId: randomUUID });

async function aMachine(museumNumber: string) {
  const registered = await executeCommand(
    registerMachineCommand,
    {
      machineModelId: medievalMadness,
      museumNumber,
      serialNumber: undefined,
      location: "Hall 2",
      machineStatus: "playable",
    },
    asEva(),
  );
  if (!registered.ok) throw new Error(registered.error);
  return registered.result.machineId;
}

/** A machine registered as `from` whose museum number was corrected to `to` – through CMD-CorrectMachineDetails. */
async function correctedMachine(from: string, to: string) {
  const machineId = await aMachine(from);
  const correction = await executeCommand(
    correctMachineDetailsCommand,
    { machineId, version: 0, museumNumber: to, serialNumber: "" },
    asEva(),
  );
  if (!correction.ok) throw new Error(correction.error);
  return machineId;
}

function writeWithoutFacts(machineId: string, museumNumber: string) {
  return executeCommand(museumNumberWithoutFacts, { machineId, version: 0, museumNumber }, asEva());
}

describe("the museum number register", () => {
  it("serializes a write of a museum number even when the command read no facts", async () => {
    const machineId = await aMachine("LG-420");

    const { writing } = await whileHoldingRow(
      db,
      sql`SELECT pg_advisory_xact_lock(hashtext('museum-number'))`,
      async (untilWaiting) => {
        const writing = writeWithoutFacts(machineId, "LG-042");
        await untilWaiting(1);
        return { writing };
      },
    );

    expect(await writing).toMatchObject({ ok: true });
  });

  it("lets a write that keeps the machine's museum number pass without waiting for the lock", async () => {
    const machineId = await aMachine("LG-042");

    const moved = await whileHoldingRow(
      db,
      sql`SELECT pg_advisory_xact_lock(hashtext('museum-number'))`,
      async () => ({
        outcome: await executeCommand(moveMachineCommand, { machineId, version: 0, location: "Workshop" }, asEva()),
      }),
    );

    expect(moved.outcome).toMatchObject({ ok: true });
  });

  it("answers a museum number in use, written past the facts, with museum-number-taken", async () => {
    await aMachine("LG-013");
    const machineId = await aMachine("LG-042");

    expect(await writeWithoutFacts(machineId, "LG-013")).toEqual({ ok: false, error: "museum-number-taken" });
    expect((await machineForTeamForm(db, "LG-042"))?.id).toBe(machineId);
  });

  it("answers a reserved museum number, written past the facts, with museum-number-taken", async () => {
    await correctedMachine("LG-420", "LG-042");
    const machineId = await aMachine("LG-043");

    expect(await writeWithoutFacts(machineId, "LG-420")).toEqual({ ok: false, error: "museum-number-taken" });
  });

  it("finds the machine of a current or a reserved museum number, by its current one", async () => {
    const machineId = await correctedMachine("LG-420", "LG-042");

    expect(await machineOfMuseumNumber(db, "LG-420")).toEqual({ machineId, museumNumber: "LG-042" });
    expect(await machineOfMuseumNumber(db, "LG-042")).toEqual({ machineId, museumNumber: "LG-042" });
    expect(await machineOfMuseumNumber(db, "LG-999")).toBeUndefined();
  });
});
