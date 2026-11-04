import { randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { fixedClock } from "@/platform/clock";
import { executeCommand, journalOf, type Actor } from "@/platform/command";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { anExistingTeamMember } from "@/test-support/team-members";
import {
  correctMachineDetailsCommand,
  createMachineModelCommand,
  machineOfMuseumNumber,
  machineForTeamForm,
  machineRecord,
  registerMachineCommand,
  type CorrectMachineDetailsInput,
} from ".";
import { withoutMachines } from "./machines.test-support";
import { retireMachineCommand } from "./retire-machine-command";

/**
 * CMD-CorrectMachineDetails through the command layer (ST-035). A new museum number is unique among all museum
 * numbers ever given out (HS-17, D11) – a rule over the whole set – so these tests run in a database of their own,
 * emptied of machines before each test.
 */
const isolated = isolatedTestDatabase("correct_machine_details");
let db: NodePgDatabase;
const eva = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;
const clock = fixedClock("2026-10-25T10:00:00Z");
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

function register(museumNumber: string) {
  return executeCommand(
    registerMachineCommand,
    {
      machineModelId: medievalMadness,
      museumNumber,
      serialNumber: undefined,
      location: "Hall 2, row 3",
      machineStatus: "playable",
    },
    { actor: eva, db, clock, newId: randomUUID },
  );
}

async function aMachine(museumNumber: string) {
  const registered = await register(museumNumber);
  if (!registered.ok) throw new Error(registered.error);
  return registered.result.machineId;
}

async function retire(museumNumber: string) {
  const shown = await machineForTeamForm(db, museumNumber);
  const retired =
    shown &&
    (await executeCommand(
      retireMachineCommand,
      { machineId: shown.id, version: shown.version, reason: "Sold" },
      { actor: eva, db, clock, newId: randomUUID },
    ));
  if (!retired?.ok) throw new Error(`${museumNumber} not retired`);
}

/** The correction as the form sends it: the machine's details as its form shows them, with the given ones changed. */
async function correct(museumNumber: string, change: Partial<CorrectMachineDetailsInput>, actor: Actor = eva) {
  const shown = await machineForTeamForm(db, museumNumber);
  if (!shown) throw new Error(`no machine ${museumNumber}`);
  return executeCommand(
    correctMachineDetailsCommand,
    {
      machineId: shown.id,
      version: shown.version,
      museumNumber: shown.museumNumber,
      serialNumber: shown.serialNumber ?? "",
      ...change,
    },
    { actor, db, clock, newId: randomUUID },
  );
}

async function corrected(museumNumber: string, change: Partial<CorrectMachineDetailsInput>) {
  const outcome = await correct(museumNumber, change);
  if (!outcome.ok) throw new Error(outcome.error);
}

describe("CMD-CorrectMachineDetails", () => {
  it("ST-035: Technician adds a serial number later", async () => {
    await aMachine("LG-042");

    await corrected("LG-042", { serialNumber: "MM-12345" });

    expect((await machineRecord(db, "LG-042"))?.serialNumber).toBe("MM-12345");
  });

  it("ST-035: The old museum number stays reserved", async () => {
    await aMachine("LG-420");
    await corrected("LG-420", { museumNumber: "LG-042" });

    expect(await register("LG-420")).toEqual({ ok: false, error: "museum-number-taken" });
  });

  it("ST-035: New museum number already used", async () => {
    await aMachine("LG-013");
    await retire("LG-013");
    await aMachine("LG-042");

    expect(await correct("LG-042", { museumNumber: "LG-013" })).toEqual({ ok: false, error: "museum-number-taken" });
    expect((await machineRecord(db, "LG-042"))?.museumNumber).toBe("LG-042");
  });

  it("ST-035: Correction and registration race for the same number", async () => {
    await aMachine("LG-420");

    const [correction, registration] = await Promise.all([correct("LG-420", { museumNumber: "LG-060" }), register("LG-060")]);

    expect([correction.ok, registration.ok].sort()).toEqual([false, true]);
    expect([correction, registration].find((outcome) => !outcome.ok)).toEqual({ ok: false, error: "museum-number-taken" });
    const owner = await machineForTeamForm(db, "LG-060");
    expect(owner?.id).toBe(correction.ok ? correction.result.machineId : registration.ok && registration.result.machineId);
  });

  it("ST-035: Reserved number cannot be taken by a correction", async () => {
    await aMachine("LG-420");
    await corrected("LG-420", { museumNumber: "LG-042" });
    await aMachine("LG-043");

    expect(await correct("LG-043", { museumNumber: "LG-420" })).toEqual({ ok: false, error: "museum-number-taken" });
  });

  it("ST-035: Retired machines cannot be corrected", async () => {
    await aMachine("LG-013");
    await retire("LG-013");

    expect(await correct("LG-013", { serialNumber: "MM-12345" })).toEqual({ ok: false, error: "machine-retired" });
  });

  it("ST-035: Helpers cannot correct machine details", async () => {
    await aMachine("LG-042");

    expect(await correct("LG-042", { museumNumber: "LG-043" }, tom)).toEqual({ ok: false, error: "not-authorized" });
    expect(await correct("LG-042", { serialNumber: "MM-12345" }, tom)).toEqual({ ok: false, error: "not-authorized" });
    expect(await machineRecord(db, "LG-042")).toMatchObject({ museumNumber: "LG-042", serialNumber: undefined });
  });

  it("removes a mistyped serial number when the field is emptied (user, 2026-10-25)", async () => {
    await aMachine("LG-042");
    await corrected("LG-042", { serialNumber: "MM-12345" });

    await corrected("LG-042", { serialNumber: "  " });

    expect((await machineRecord(db, "LG-042"))?.serialNumber).toBeUndefined();
  });

  it("journals both museum numbers and never the typed serial number", async () => {
    const machineId = await aMachine("LG-420");

    await corrected("LG-420", { museumNumber: "LG-042", serialNumber: "MM-12345" });

    const entry = (await journalOf(db, { aggregateId: machineId })).find(
      (journaled) => journaled.type === "EVT-MachineDetailsCorrected",
    );
    expect(entry).toMatchObject({ machineId, data: { museumNumber: "LG-042", previousMuseumNumber: "LG-420" } });
    expect(JSON.stringify(entry?.data)).not.toContain("MM-12345");
  });

  it("keeps every earlier museum number reserved, leading to the current one", async () => {
    const machineId = await aMachine("LG-420");
    await corrected("LG-420", { museumNumber: "LG-042" });
    await corrected("LG-042", { museumNumber: "LG-024" });

    expect(await machineOfMuseumNumber(db, "LG-420")).toEqual({ machineId, museumNumber: "LG-024" });
    expect(await machineOfMuseumNumber(db, "LG-042")).toEqual({ machineId, museumNumber: "LG-024" });
    expect(await register("LG-042")).toEqual({ ok: false, error: "museum-number-taken" });
  });

  it("rejects a correction that changes nothing", async () => {
    await aMachine("LG-042");

    expect(await correct("LG-042", {})).toEqual({ ok: false, error: "machine-details-unchanged" });
  });
});
