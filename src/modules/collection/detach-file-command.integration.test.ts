import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { fixedClock } from "@/platform/clock";
import { executeCommand, journalOf } from "@/platform/command";
import { whileHoldingRow } from "@/test-support/held-row";
import { machinesOfOneModel, retireMachine } from "@/test-support/machines";
import { anExistingTeamMember } from "@/test-support/team-members";
import { testDatabase } from "@/test-support/database";
import {
  addFileCommand,
  attachFileCommand,
  detachFileCommand,
  fileDetails,
  fileForRemoval,
  machineModelOfMachineForAi,
  removeFileCommand,
} from ".";

/**
 * CMD-DetachFile (ST-115): a technician detaches a file from one machine or machine model in one tap. A set delta – what
 * is already detached is nothing to do, and a real change raises the file's version. Real PostgreSQL; the files are added
 * and attached through the commands.
 */
const db = testDatabase();
const clock = fixedClock("2026-11-03T10:00:00Z");
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const ben = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;
const at = () => ({ db, clock, newId: randomUUID });

async function aFile(
  { machines = [], models = [] }: { machines?: string[]; models?: string[] },
  title = "A file",
): Promise<string> {
  const added = await executeCommand(
    addFileCommand,
    {
      title,
      fileCategory: "manual",
      originalFileName: undefined,
      machineIds: machines,
      machineModelIds: models,
      content: { name: `files/${randomUUID()}`, size: 4_200_000, contentType: "application/pdf" },
    },
    { actor: tom, ...at() },
  );
  if (!added.ok) throw new Error(added.error);
  return added.result.fileId;
}

const attach = (fileId: string, input: { machineIds?: string[]; machineModelIds?: string[] }) =>
  executeCommand(
    attachFileCommand,
    { fileId, machineIds: input.machineIds ?? [], machineModelIds: input.machineModelIds ?? [] },
    { actor: tom, ...at() },
  );

const detach = (
  fileId: string,
  target: { machineId: string } | { machineModelId: string },
  actor: typeof tom | typeof ben = tom,
) => executeCommand(detachFileCommand, { fileId, target }, { actor, ...at() });

const versionOf = async (fileId: string) => (await fileForRemoval(db, fileId))!.version;

describe("detaching a file (ST-115)", () => {
  it("detaches a machine and a machine model in one tap", async () => {
    await anExistingTeamMember(db, tom, "Tom");
    const [lg042] = await machinesOfOneModel(db, 1);
    const model = (await machineModelOfMachineForAi(db, lg042.machineId))!;
    const fileId = await aFile({ machines: [lg042.machineId], models: [model.id] });

    expect(await detach(fileId, { machineId: lg042.machineId })).toMatchObject({ ok: true });
    expect((await fileDetails(db, fileId))!.attachedTo).toEqual([
      { kind: "machine-model", machineModelId: model.id, title: model.title },
    ]);
    expect(await versionOf(fileId)).toBe(1);
    expect((await journalOf(db, { aggregateId: fileId })).at(-1)).toMatchObject({
      type: "EVT-FileDetached",
      aggregate: { type: "AGG-File", id: fileId },
      machineId: lg042.machineId,
      actor: { kind: "team-member", teamMemberId: tom.teamMemberId },
    });

    expect(await detach(fileId, { machineModelId: model.id })).toMatchObject({ ok: true });
    expect((await fileDetails(db, fileId))!.attachedTo).toEqual([]);
    expect(await versionOf(fileId)).toBe(2);
  });

  it("detaching what is already detached changes nothing", async () => {
    await anExistingTeamMember(db, tom, "Tom");
    const [lg042] = await machinesOfOneModel(db, 1);
    const fileId = await aFile({ machines: [lg042.machineId] });
    expect(await detach(fileId, { machineId: lg042.machineId })).toMatchObject({ ok: true });
    const before = await versionOf(fileId);

    expect(await detach(fileId, { machineId: lg042.machineId })).toEqual({
      ok: true,
      result: { fileId, target: { machineId: lg042.machineId } },
    });
    expect(await versionOf(fileId)).toBe(before);
    expect(
      (await journalOf(db, { aggregateId: fileId })).filter((step) => step.type === "EVT-FileDetached"),
    ).toHaveLength(1);
  });

  it("detaching what was never attached changes nothing", async () => {
    await anExistingTeamMember(db, tom, "Tom");
    const [lg042, lg050] = await machinesOfOneModel(db, 2);
    const fileId = await aFile({ machines: [lg042.machineId] });
    const before = await versionOf(fileId);

    expect(await detach(fileId, { machineId: lg050.machineId })).toEqual({
      ok: true,
      result: { fileId, target: { machineId: lg050.machineId } },
    });
    expect(await versionOf(fileId)).toBe(before);
    expect((await fileDetails(db, fileId))!.attachedTo).toHaveLength(1);
  });

  it("a forged detach without a target is refused", async () => {
    await anExistingTeamMember(db, tom, "Tom");
    const [lg042] = await machinesOfOneModel(db, 1);
    const fileId = await aFile({ machines: [lg042.machineId] });

    expect(await executeCommand(detachFileCommand, { fileId, target: undefined }, { actor: tom, ...at() })).toEqual({
      ok: false,
      error: "target-required",
    });
  });

  it("two detaches at the same moment both stand, with one event", async () => {
    await anExistingTeamMember(db, tom, "Tom");
    const [lg042] = await machinesOfOneModel(db, 1);
    const fileId = await aFile({ machines: [lg042.machineId] });

    const { first, second } = await whileHoldingRow(
      db,
      sql`SELECT id FROM file WHERE id = ${fileId} FOR UPDATE`,
      async (untilWaiting) => {
        const first = detach(fileId, { machineId: lg042.machineId });
        await untilWaiting(1);
        const second = detach(fileId, { machineId: lg042.machineId });
        await untilWaiting(2);
        return { first, second };
      },
    );

    expect(await first).toMatchObject({ ok: true });
    expect(await second).toMatchObject({ ok: true });
    expect((await fileDetails(db, fileId))!.attachedTo).toEqual([]);
    expect(
      (await journalOf(db, { aggregateId: fileId })).filter((step) => step.type === "EVT-FileDetached"),
    ).toHaveLength(1);
  });

  it("a helper cannot detach a file", async () => {
    await anExistingTeamMember(db, ben, "Ben");
    const [lg042] = await machinesOfOneModel(db, 1);
    const fileId = await aFile({ machines: [lg042.machineId] });

    expect(await detach(fileId, { machineId: lg042.machineId }, ben)).toEqual({
      ok: false,
      error: "not-authorized",
    });
    expect((await fileDetails(db, fileId))!.attachedTo).toHaveLength(1);
  });

  it("detaches a retired machine", async () => {
    await anExistingTeamMember(db, tom, "Tom");
    const [lg041] = await machinesOfOneModel(db, 1);
    await retireMachine(db, lg041.machineId);
    const fileId = await aFile({});
    expect(await attach(fileId, { machineIds: [lg041.machineId] })).toMatchObject({ ok: true });

    expect(await detach(fileId, { machineId: lg041.machineId })).toMatchObject({ ok: true });
    expect((await fileDetails(db, fileId))!.attachedTo).toEqual([]);
  });

  it("a removed file cannot be detached", async () => {
    await anExistingTeamMember(db, tom, "Tom");
    const [lg042] = await machinesOfOneModel(db, 1);
    const fileId = await aFile({ machines: [lg042.machineId] });
    const removed = await executeCommand(removeFileCommand, { fileId, version: 0 }, { actor: tom, ...at() });
    if (!removed.ok) throw new Error(removed.error);
    const journal = await journalOf(db, { aggregateId: fileId });

    expect(await detach(fileId, { machineId: lg042.machineId })).toEqual({ ok: false, error: "file-removed" });
    expect(await journalOf(db, { aggregateId: fileId })).toEqual(journal);
  });
});
