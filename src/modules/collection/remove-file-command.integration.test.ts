import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { fixedClock } from "@/platform/clock";
import { executeCommand } from "@/platform/command";
import { testDatabase } from "@/test-support/database";
import { anExistingTeamMember } from "@/test-support/team-members";
import {
  attachFileCommand,
  createMachineModelCommand,
  fileToOpen,
  machineRecord,
  registerMachineCommand,
  removeFileCommand,
} from ".";

/**
 * CMD-RemoveFile (ST-038) through the command layer, observed through the machine record (RM-MachineRecord) and what
 * opening a file finds. Deleting the content from the storage is the form's step after the commit – tested at the
 * Server Action runner (`datei-entfernen/[fileId]/remove-file.integration.test.ts`).
 */
const db = testDatabase();
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const anna = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;
const at = { db, clock: fixedClock("2026-10-25T10:00:00Z"), newId: randomUUID };

beforeAll(async () => {
  for (const member of [tom, anna]) await anExistingTeamMember(db, member);
});

/** A machine with a file of its own; returns the machine's museum number and the file's ID. */
async function aMachineWithFile(title: string) {
  const model = await executeCommand(
    createMachineModelCommand,
    { title: `Medieval Madness ${randomUUID().slice(0, 8)}`, manufacturer: "Williams", machineCategory: "pinball" },
    { actor: tom, ...at },
  );
  if (!model.ok) throw new Error(model.error);
  const machine = await executeCommand(
    registerMachineCommand,
    {
      machineModelId: model.result.machineModelId,
      museumNumber: undefined,
      serialNumber: undefined,
      location: "Hall 2",
      machineStatus: "playable",
    },
    { actor: tom, ...at },
  );
  if (!machine.ok) throw new Error(machine.error);
  const attached = await executeCommand(
    attachFileCommand,
    {
      machineId: machine.result.machineId,
      attachTo: "machine",
      title,
      fileCategory: "manual",
      content: { name: `files/${randomUUID()}`, size: 4_200_000, contentType: "application/pdf" },
    },
    { actor: tom, ...at },
  );
  if (!attached.ok) throw new Error(attached.error);
  return { museumNumber: machine.result.museumNumber, fileId: attached.result.fileId };
}

const remove = (fileId: string, actor: typeof tom | typeof anna, version = 0) =>
  executeCommand(removeFileCommand, { fileId, version }, { actor, ...at });

const titlesOf = async (museumNumber: string) =>
  (await machineRecord(db, museumNumber))!.files.map((file) => file.title);

describe("CMD-RemoveFile", () => {
  it("ST-038: Helpers cannot remove files", async () => {
    const { museumNumber, fileId } = await aMachineWithFile("MM Operations Manual");

    const removed = await remove(fileId, anna);

    expect(removed).toEqual({ ok: false, error: "not-authorized" });
    expect(await titlesOf(museumNumber)).toEqual(["MM Operations Manual"]);
  });

  it("ST-038: A removed file stays removed", async () => {
    const { museumNumber, fileId } = await aMachineWithFile("MM Manual (wrong edition)");
    expect(await remove(fileId, tom)).toMatchObject({ ok: true });

    expect(await fileToOpen(db, fileId)).toBeUndefined();
    expect(await remove(fileId, tom, 1)).toEqual({ ok: false, error: "file-removed" });
    expect(await titlesOf(museumNumber)).toEqual([]);
  });

  it("names the removed content, so the form can delete it from the storage", async () => {
    const { fileId } = await aMachineWithFile("MM Schematics (blurred)");
    const opened = await fileToOpen(db, fileId);

    const removed = await remove(fileId, tom);

    expect(removed).toEqual({ ok: true, result: { removedContent: opened!.content } });
  });

  it("is refused when the file changed since the technician saw it", async () => {
    const { fileId } = await aMachineWithFile("MM Flyer");

    expect(await remove(fileId, tom, 3)).toEqual({ ok: false, error: "version-conflict" });
  });
});
