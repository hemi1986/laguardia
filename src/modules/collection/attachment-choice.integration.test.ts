import { randomUUID } from "node:crypto";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  addFileCommand,
  attachmentChoice,
  createMachineModelCommand,
  registerMachineCommand,
  removeFileCommand,
} from "@/modules/collection";
import { retireMachineCommand } from "@/modules/repair";
import { fixedClock } from "@/platform/clock";
import { executeCommand } from "@/platform/command";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { anExistingTeamMember } from "@/test-support/team-members";

/**
 * RM-AttachmentChoice (ST-115): what a file can still be attached to, grouped by machine category and technology. A
 * database of its own, so the machines can carry the scenario's museum numbers; everything is set up through commands.
 */
const isolated = isolatedTestDatabase("attachment_choice");
let db: NodePgDatabase;
const clock = fixedClock("2026-11-03T10:00:00Z");
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const at = () => ({ actor: tom, db, clock, newId: randomUUID });
let medievalMadness: string;
let eightBall: string;

afterAll(() => isolated.close());

beforeEach(async () => {
  db = await isolated.reset();
  await anExistingTeamMember(db, tom, "Tom");
  medievalMadness = await aModel("Medieval Madness", "pinball", "em");
  eightBall = await aModel("Eight Ball", "pinball", "em");
});

async function aModel(
  title: string,
  machineCategory: "pinball" | "arcade" | "other",
  technology?: "em",
): Promise<string> {
  const created = await executeCommand(
    createMachineModelCommand,
    { title, manufacturer: "Williams", year: "1997", machineCategory, technology },
    at(),
  );
  if (!created.ok) throw new Error(created.error);
  return created.result.machineModelId;
}

async function aMachine(machineModelId: string, museumNumber: string): Promise<string> {
  const registered = await executeCommand(
    registerMachineCommand,
    { machineModelId, museumNumber, serialNumber: undefined, location: "Hall 1", machineStatus: "playable" },
    at(),
  );
  if (!registered.ok) throw new Error(registered.error);
  return registered.result.machineId;
}

async function retire(machineId: string) {
  const retired = await executeCommand(
    retireMachineCommand,
    { machineId, version: 0, reason: "Sold to a collector" },
    at(),
  );
  if (!retired.ok) throw new Error(retired.error);
}

async function aFile(attachedTo: { machineIds?: string[]; machineModelIds?: string[] }, title: string) {
  const added = await executeCommand(
    addFileCommand,
    {
      title,
      fileCategory: "manual",
      originalFileName: undefined,
      machineIds: attachedTo.machineIds ?? [],
      machineModelIds: attachedTo.machineModelIds ?? [],
      content: { name: `files/${randomUUID()}`, size: 4_200_000, contentType: "application/pdf" },
    },
    at(),
  );
  if (!added.ok) throw new Error(added.error);
  return added.result.fileId;
}

describe("the machines and machine models a file can be attached to (ST-115)", () => {
  it("offers only what the file is not attached to yet, retired machines at the end of their group", async () => {
    const lg042 = await aMachine(medievalMadness, "LG-042");
    const lg041 = await aMachine(eightBall, "LG-041");
    await aMachine(eightBall, "LG-050");
    await retire(lg041);
    const manual = await aFile({ machineIds: [lg042], machineModelIds: [medievalMadness] }, "MM Operations Manual");

    const choice = (await attachmentChoice(db, manual))!;

    expect(choice).toMatchObject({ title: "MM Operations Manual", removed: false });
    // „Geräte“ and „Modelle“ are two parts; each group is by machine category and technology, in CONTEXT.md's order.
    expect(choice.machineGroups).toHaveLength(1);
    expect(choice.machineGroups[0]).toMatchObject({ machineCategory: "pinball", technology: "em" });
    // LG-042 is attached, so it is not offered. A retired machine is offered at the end of its group, although its
    // museum number is lower.
    expect(choice.machineGroups[0].machines.map((machine) => [machine.museumNumber, machine.retired])).toEqual([
      ["LG-050", false],
      ["LG-041", true],
    ]);
    // The machine model the file is attached to is not offered either.
    expect(choice.machineModelGroups.flatMap((group) => group.machineModels.map((model) => model.title))).toEqual([
      "Eight Ball",
    ]);
  });

  it("offers every machine of a model the file is attached to", async () => {
    const lg042 = await aMachine(medievalMadness, "LG-042");
    const lg043 = await aMachine(medievalMadness, "LG-043");
    const manual = await aFile({ machineModelIds: [medievalMadness] }, "MM Operations Manual");

    const choice = (await attachmentChoice(db, manual))!;

    expect(choice.machineGroups.flatMap((group) => group.machines.map((machine) => machine.id)).sort()).toEqual(
      [lg042, lg043].sort(),
    );
    expect(choice.machineModelGroups.flatMap((group) => group.machineModels.map((model) => model.title))).toEqual([
      "Eight Ball",
    ]);
  });

  it("offers nothing for a removed file", async () => {
    const lg042 = await aMachine(medievalMadness, "LG-042");
    const manual = await aFile({ machineIds: [lg042] }, "Old manual");
    const removed = await executeCommand(removeFileCommand, { fileId: manual, version: 0 }, at());
    if (!removed.ok) throw new Error(removed.error);

    expect(await attachmentChoice(db, manual)).toEqual({
      title: "Old manual",
      removed: true,
      machineGroups: [],
      machineModelGroups: [],
    });
  });
});
