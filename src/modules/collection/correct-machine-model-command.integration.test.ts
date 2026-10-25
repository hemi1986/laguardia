import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { fixedClock } from "@/platform/clock";
import { executeCommand, journalOf } from "@/platform/command";
import { testDatabase } from "@/test-support/database";
import { anExistingTeamMember } from "@/test-support/team-members";
import {
  correctMachineModelCommand,
  createMachineModelCommand,
  machineModelsToChooseFrom,
  machineRecord,
  registerMachineCommand,
  visitorMachine,
  type CorrectMachineModelInput,
  type CreateMachineModelInput,
} from ".";

/**
 * CMD-CorrectMachineModel (ST-036) through the command layer, against real PostgreSQL – observed through the machine
 * record, the visitor machine page's read model and the machine models to choose from.
 */
const db = testDatabase();
const eva = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const anna = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;
const at = (instant: string) => ({ db, clock: fixedClock(instant), newId: randomUUID });

beforeAll(async () => {
  await anExistingTeamMember(db, eva);
  await anExistingTeamMember(db, anna);
});

const medievalMadness: CreateMachineModelInput = {
  title: "Medieval Madness",
  manufacturer: "Williams",
  year: "1979",
  machineCategory: "pinball",
  technology: "dmd",
};

async function aMachineModel(input: CreateMachineModelInput = medievalMadness) {
  const created = await executeCommand(createMachineModelCommand, input, { actor: eva, ...at("2026-01-10T09:00:00Z") });
  if (!created.ok) throw new Error(created.error);
  return created.result.machineModelId;
}

/** A machine of the machine model, with the museum number it was given. */
async function aMachineOf(machineModelId: string) {
  const registered = await executeCommand(
    registerMachineCommand,
    { machineModelId, museumNumber: undefined, serialNumber: undefined, location: "Hall 2", machineStatus: "playable" },
    { actor: eva, ...at("2026-01-15T09:00:00Z") },
  );
  if (!registered.ok) throw new Error(registered.error);
  return registered.result.museumNumber;
}

/** The correction a technician sends: the machine model as it is, with the given details changed. */
function correction(machineModelId: string, changed: Partial<CorrectMachineModelInput>): CorrectMachineModelInput {
  return { machineModelId, version: 0, ...medievalMadness, ...changed };
}

const correct = (input: CorrectMachineModelInput, actor: typeof eva | typeof anna = eva) =>
  executeCommand(correctMachineModelCommand, input, { actor, ...at("2026-06-01T08:00:00Z") });

const modelOf = async (machineModelId: string) =>
  (await machineModelsToChooseFrom(db)).find((model) => model.id === machineModelId);

describe("CMD-CorrectMachineModel", () => {
  it("ST-036: Technician corrects the year", async () => {
    const machineModelId = await aMachineModel();
    const museumNumber = await aMachineOf(machineModelId);

    const outcome = await correct(correction(machineModelId, { year: "1997" }));

    expect(outcome).toEqual({ ok: true, result: { machineModelId, title: "Medieval Madness" } });
    expect((await machineRecord(db, museumNumber))?.machineModel.year).toBe(1997);
    expect(await visitorMachine(db, museumNumber)).toMatchObject({ retired: false, year: 1997 });
  });

  it("journals the correction with its machine category and technology – no typed text", async () => {
    const machineModelId = await aMachineModel();

    await correct(correction(machineModelId, { title: "Medieval Madness (Remake)", technology: "lcd" }));

    const [, corrected] = await journalOf(db, { aggregateId: machineModelId });
    expect(corrected).toMatchObject({
      type: "EVT-MachineModelCorrected",
      actor: eva,
      aggregate: { type: "AGG-MachineModel", id: machineModelId },
    });
    expect(corrected.data).toEqual({ year: 1979, machineCategory: "pinball", technology: "lcd" });
  });

  it("ST-036: Technology must fit the machine category", async () => {
    const galaxian = await aMachineModel({
      title: "Galaxian",
      manufacturer: "Namco",
      machineCategory: "arcade",
      technology: "crt",
    });

    const outcome = await correct({
      machineModelId: galaxian,
      version: 0,
      title: "Galaxian",
      manufacturer: "Namco",
      machineCategory: "arcade",
      technology: "em",
    });

    expect(outcome).toEqual({ ok: false, error: "technology-does-not-fit-machine-category" });
    expect((await modelOf(galaxian))?.technology).toBe("crt");
  });

  it("ST-036: Required details stay required", async () => {
    const machineModelId = await aMachineModel();

    expect(await correct(correction(machineModelId, { title: "  " }))).toEqual({ ok: false, error: "title-required" });
    expect(await correct(correction(machineModelId, { manufacturer: "" }))).toEqual({
      ok: false,
      error: "manufacturer-required",
    });
    expect(await correct(correction(machineModelId, { machineCategory: undefined }))).toEqual({
      ok: false,
      error: "machine-category-required",
    });
    expect((await modelOf(machineModelId))?.title).toBe("Medieval Madness");
  });

  it("ST-036: A given year must be a four-digit calendar year", async () => {
    const machineModelId = await aMachineModel();

    expect(await correct(correction(machineModelId, { year: "19x7" }))).toEqual({
      ok: false,
      error: "year-must-be-four-digits",
    });
    expect((await modelOf(machineModelId))?.year).toBe(1979);
  });

  it("a correction that changes nothing is rejected (user, 2026-10-18)", async () => {
    const machineModelId = await aMachineModel();

    expect(await correct(correction(machineModelId, { title: " Medieval Madness " }))).toEqual({
      ok: false,
      error: "machine-model-unchanged",
    });
    expect(await journalOf(db, { aggregateId: machineModelId })).toHaveLength(1);
  });

  it("ST-036: Helpers cannot correct machine models", async () => {
    const machineModelId = await aMachineModel();

    expect(await correct(correction(machineModelId, { year: "1997" }), anna)).toEqual({
      ok: false,
      error: "not-authorized",
    });
    expect((await modelOf(machineModelId))?.year).toBe(1979);
  });
});
