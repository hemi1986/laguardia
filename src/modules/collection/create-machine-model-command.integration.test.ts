import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { fixedClock } from "@/platform/clock";
import { executeCommand, journalOf, type Actor } from "@/platform/command";
import { testDatabase } from "@/test-support/database";
import { anExistingTeamMember } from "@/test-support/team-members";
import {
  createMachineModelCommand,
  machineModelsToChooseFrom,
  type CreateMachineModelInput,
  type MachineModel,
} from ".";

/**
 * CMD-CreateMachineModel through the command layer, against real PostgreSQL. The new machine model is read back
 * through the read model the machine registration (ST-007) chooses from, so "it can be chosen" is really shown.
 */
const db = testDatabase();
const eva: Actor = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" };
const tom: Actor = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" };
const deps = { actor: eva, db, clock: fixedClock("2026-09-30T10:00:00Z"), newId: randomUUID };

beforeAll(async () => {
  await anExistingTeamMember(db, eva);
  await anExistingTeamMember(db, tom);
});

async function create(input: CreateMachineModelInput, actor: Actor = eva) {
  return executeCommand(createMachineModelCommand, input, { ...deps, actor });
}

/** The one machine model among the ones every test of this run creates – tests never assert on the whole list. */
async function choice(machineModelId: string) {
  return (await machineModelsToChooseFrom(db)).find((model) => model.id === machineModelId);
}

/** The same for a machine model that must not exist: one detail of it is unique to this attempt. */
async function choicesMatching(match: (model: MachineModel) => boolean) {
  return (await machineModelsToChooseFrom(db)).filter(match);
}

describe("CMD-CreateMachineModel", () => {
  it("ST-006: Technician creates a pinball machine model", async () => {
    const created = await create({
      title: "Medieval Madness",
      manufacturer: "Williams",
      year: 1997,
      machineCategory: "pinball",
      technology: "dmd",
    });
    if (!created.ok) throw new Error(created.error);

    expect(await choice(created.result.machineModelId)).toEqual({
      id: created.result.machineModelId,
      title: "Medieval Madness",
      manufacturer: "Williams",
      year: 1997,
      machineCategory: "pinball",
      technology: "dmd",
    });
  });

  it("ST-006: Technology is optional", async () => {
    const created = await create({
      title: "Wurlitzer 1015",
      manufacturer: "Wurlitzer",
      machineCategory: "other",
    });
    if (!created.ok) throw new Error(created.error);

    expect(await choice(created.result.machineModelId)).toEqual({
      id: created.result.machineModelId,
      title: "Wurlitzer 1015",
      manufacturer: "Wurlitzer",
      year: undefined,
      machineCategory: "other",
      technology: undefined,
    });
  });

  it("ST-006: Helpers cannot create machine models", async () => {
    const title = `Xenon ${randomUUID()}`;

    const rejected = await create({ title, manufacturer: "Bally", machineCategory: "pinball" }, tom);

    expect(rejected).toEqual({ ok: false, error: "not-authorized" });
    expect(await choicesMatching((model) => model.title === title)).toEqual([]);
  });

  it("stores nothing when the machine model is rejected", async () => {
    // The title is blank, so the rejected attempt is recognised by its manufacturer.
    const manufacturer = `Gottlieb ${randomUUID()}`;

    expect(await create({ title: "   ", manufacturer, machineCategory: "pinball" })).toEqual({
      ok: false,
      error: "title-required",
    });

    expect(await choicesMatching((model) => model.manufacturer === manufacturer)).toEqual([]);
  });

  it("journals the created machine model without its title and manufacturer", async () => {
    const created = await create({
      title: "Eight Ball Deluxe",
      manufacturer: "Bally",
      year: 1981,
      machineCategory: "pinball",
      technology: "solid-state",
    });
    if (!created.ok) throw new Error(created.error);

    const entries = await journalOf(db, { aggregateId: created.result.machineModelId });
    expect(entries).toEqual([
      {
        type: "EVT-MachineModelCreated",
        occurredAt: new Date("2026-09-30T10:00:00Z"),
        actor: eva,
        aggregate: { type: "AGG-MachineModel", id: created.result.machineModelId },
        machineId: null,
        data: { machineCategory: "pinball", technology: "solid-state" },
      },
    ]);
    expect(JSON.stringify(entries)).not.toContain("Eight Ball Deluxe");
    expect(JSON.stringify(entries)).not.toContain("Bally");
  });
});
