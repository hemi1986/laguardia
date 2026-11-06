import { randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { fixedClock } from "@/platform/clock";
import { executeCommand } from "@/platform/command";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { retireMachine } from "@/test-support/machines";
import { anExistingTeamMember, TEST_TECHNICIAN } from "@/test-support/team-members";
import {
  addFileCommand,
  createMachineModelCommand,
  detachFileCommand,
  fileOverview,
  fileOverviewChoices,
  registerMachineCommand,
  removeFileCommand,
  type FileCategory,
  type FileOverviewFilter,
} from ".";

/**
 * RM-FileOverview, Collection's part (ST-117, context map step 1): every file that is not removed with the overview's
 * fields, newest first, narrowed by file category and by what it is attached to (HS-36). Real PostgreSQL in a database of
 * its own – the count of "every file" is the whole set. Data is set up through the commands (Q3).
 */
const isolated = isolatedTestDatabase("file_overview");
let db: NodePgDatabase;
const actor = TEST_TECHNICIAN;
const at = (time: string) => ({ actor, db, clock: fixedClock(time), newId: randomUUID });

beforeEach(async () => {
  db = await isolated.reset();
  await anExistingTeamMember(db, actor);
});
afterAll(() => isolated.close());

let day = 0;
/** A file added on its own day, so the order is the order they were added in. */
async function aFile(
  title: string,
  {
    fileCategory = "manual",
    machines = [],
    models = [],
    contentType = "application/pdf",
    size = 4_200_000,
  }: {
    fileCategory?: FileCategory;
    machines?: string[];
    models?: string[];
    contentType?: string;
    size?: number;
  } = {},
): Promise<string> {
  day += 1;
  const added = await executeCommand(
    addFileCommand,
    {
      title,
      fileCategory,
      originalFileName: undefined,
      machineIds: machines,
      machineModelIds: models,
      content: { name: `files/${randomUUID()}`, size, contentType },
    },
    at(`2026-10-${String(day % 28 || 28).padStart(2, "0")}T10:00:00Z`),
  );
  if (!added.ok) throw new Error(added.error);
  return added.result.fileId;
}

async function aModel(title: string): Promise<string> {
  const created = await executeCommand(
    createMachineModelCommand,
    { title, manufacturer: "Williams", machineCategory: "pinball" },
    at("2026-09-01T10:00:00Z"),
  );
  if (!created.ok) throw new Error(created.error);
  return created.result.machineModelId;
}

async function aMachine(museumNumber: string, machineModelId: string): Promise<string> {
  const registered = await executeCommand(
    registerMachineCommand,
    { machineModelId, museumNumber, serialNumber: undefined, location: "Hall 1", machineStatus: "playable" },
    at("2026-09-02T10:00:00Z"),
  );
  if (!registered.ok) throw new Error(registered.error);
  return registered.result.machineId;
}

const titles = async (filter: FileOverviewFilter = {}) => (await fileOverview(db, filter)).map((entry) => entry.title);

describe("RM-FileOverview (ST-117)", () => {
  it("ST-117: Filtering by file category", async () => {
    await aFile("MM Operations Manual", { fileCategory: "manual" });
    await aFile("MM Wiring", { fileCategory: "schematic" });
    await aFile("MM Backglass", { fileCategory: "photo" });

    expect(await titles({ fileCategory: "schematic" })).toEqual(["MM Wiring"]);
    expect(await titles({ fileCategory: "other" })).toEqual([]);
    expect(await titles()).toHaveLength(3);
  });

  it("ST-117: The filter „Angehängt an“ finds what the machine record shows, what belongs to the machine model, and what is attached to nothing", async () => {
    const medievalMadness = await aModel("Medieval Madness");
    const otherModel = await aModel("Attack from Mars");
    const lg042 = await aMachine("LG-042", medievalMadness);
    const lg041 = await aMachine("LG-041", medievalMadness);
    const lg050 = await aMachine("LG-050", otherModel);
    await aFile("Model manual", { models: [medievalMadness] });
    await aFile("Own notes", { machines: [lg042] });
    await aFile("Retired notes", { machines: [lg041] });
    await aFile("Other notes", { machines: [lg050] });
    await aFile("Wiring notes");
    await retireMachine(db, lg041);

    const examples: [FileOverviewFilter["attachedTo"], string[]][] = [
      [{ machineId: lg042 }, ["Own notes", "Model manual"]],
      [{ machineId: lg041 }, ["Retired notes", "Model manual"]],
      [{ machineModelId: medievalMadness }, ["Retired notes", "Own notes", "Model manual"]],
      ["nowhere", ["Wiring notes"]],
    ];
    for (const [attachedTo, expected] of examples) {
      // Newest first: the order they were added in, reversed.
      expect(await titles({ attachedTo })).toEqual(expected);
    }
  });

  it("lists every file that is not removed, newest first, with the fields of an entry", async () => {
    const old = await aFile("Old manual");
    await aFile("Wiring notes", { fileCategory: "other", contentType: "image/png", size: 12_400_000 });
    await aFile("MM Operations Manual");
    const removed = await executeCommand(removeFileCommand, { fileId: old, version: 0 }, at("2026-11-02T10:00:00Z"));
    if (!removed.ok) throw new Error(removed.error);

    const entries = await fileOverview(db, {});

    expect(entries.map((entry) => entry.title)).toEqual(["MM Operations Manual", "Wiring notes"]);
    expect(entries[1]).toMatchObject({ fileCategory: "other", mediaType: "png", size: 12_400_000 });
    expect(entries[0].addedAt).toBeInstanceOf(Date);
  });

  it("a file detached from everything is listed and found as attached to nothing", async () => {
    const model = await aModel("Medieval Madness");
    const lg042 = await aMachine("LG-042", model);
    const fileId = await aFile("Own notes", { machines: [lg042] });
    expect(await titles({ attachedTo: "nowhere" })).toEqual([]);

    const detached = await executeCommand(
      detachFileCommand,
      { fileId, target: { machineId: lg042 } },
      at("2026-11-02T10:00:00Z"),
    );
    if (!detached.ok) throw new Error(detached.error);

    expect(await titles({ attachedTo: "nowhere" })).toEqual(["Own notes"]);
    expect(await titles({ attachedTo: { machineId: lg042 } })).toEqual([]);
  });

  it("filters combine: every one has to hold", async () => {
    const model = await aModel("Medieval Madness");
    await aFile("Model manual", { models: [model] });
    await aFile("Model schematic", { models: [model], fileCategory: "schematic" });
    await aFile("Loose manual");

    expect(await titles({ fileCategory: "manual", attachedTo: { machineModelId: model } })).toEqual(["Model manual"]);
    expect(await titles({ fileCategory: "schematic", attachedTo: "nowhere" })).toEqual([]);
  });

  it("offers the machines by museum number, retired ones last, and the machine models by title", async () => {
    const mm = await aModel("Medieval Madness");
    const afm = await aModel("Attack from Mars");
    await aMachine("LG-050", afm);
    const lg041 = await aMachine("LG-041", mm);
    await aMachine("LG-042", mm);
    await retireMachine(db, lg041);

    const choices = await fileOverviewChoices(db);

    expect(
      choices.machines.map((machine) => [machine.museumNumber, machine.machineModelTitle, machine.retired]),
    ).toEqual([
      ["LG-042", "Medieval Madness", false],
      ["LG-050", "Attack from Mars", false],
      ["LG-041", "Medieval Madness", true],
    ]);
    expect(choices.machineModels.map((model) => model.title)).toEqual(["Attack from Mars", "Medieval Madness"]);
  });
});
