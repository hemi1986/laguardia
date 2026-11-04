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
  fileDetails,
  fileForRemoval,
  machineModelOfMachineForAi,
  removeFileCommand,
} from ".";

/**
 * CMD-AttachFile (ST-115): an existing file is attached to further machines and machine models. A set delta – no version
 * is posted, what is already attached is nothing to do, and a real change raises the file's version. Real PostgreSQL; the
 * files are added through CMD-AddFile, the machines through the commands.
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

const attach = (
  fileId: string,
  input: { machineIds?: string[]; machineModelIds?: string[] },
  actor: typeof tom | typeof ben = tom,
) =>
  executeCommand(
    attachFileCommand,
    { fileId, machineIds: input.machineIds ?? [], machineModelIds: input.machineModelIds ?? [] },
    { actor, ...at() },
  );

const versionOf = async (fileId: string) => (await fileForRemoval(db, fileId))!.version;

describe("attaching a file (ST-115)", () => {
  it("attaches a file to machines and machine models in one step", async () => {
    await anExistingTeamMember(db, tom, "Tom");
    const [lg042, lg050] = await machinesOfOneModel(db, 2);
    const model = (await machineModelOfMachineForAi(db, lg050.machineId))!;
    const fileId = await aFile({});

    const attached = await attach(fileId, {
      machineIds: [lg042.machineId, lg050.machineId],
      machineModelIds: [model.id],
    });

    expect(attached).toMatchObject({ ok: true });
    expect((await fileDetails(db, fileId))!.attachedTo.map((target) => target.kind)).toEqual([
      "machine",
      "machine",
      "machine-model",
    ]);
    expect(await versionOf(fileId)).toBe(1);
    const steps = await journalOf(db, { aggregateId: fileId });
    expect(steps.filter((step) => step.type === "EVT-FileAttached")).toHaveLength(3);
    expect(steps.find((step) => step.type === "EVT-FileAttached" && step.machineId === lg042.machineId)).toMatchObject({
      aggregate: { type: "AGG-File", id: fileId },
      actor: { kind: "team-member", teamMemberId: tom.teamMemberId },
    });
  });

  it("a helper may attach a file", async () => {
    await anExistingTeamMember(db, ben, "Ben");
    const [lg042] = await machinesOfOneModel(db, 1);
    const fileId = await aFile({});

    expect(await attach(fileId, { machineIds: [lg042.machineId] }, ben)).toMatchObject({ ok: true });
    expect((await fileDetails(db, fileId))!.attachedTo).toHaveLength(1);
  });

  it("attaching a target again changes nothing", async () => {
    await anExistingTeamMember(db, tom, "Tom");
    const [lg042] = await machinesOfOneModel(db, 1);
    const fileId = await aFile({ machines: [lg042.machineId] });
    const before = await versionOf(fileId);

    expect(await attach(fileId, { machineIds: [lg042.machineId] })).toEqual({
      ok: true,
      result: { fileId },
    });
    expect(await versionOf(fileId)).toBe(before);
    expect(
      (await journalOf(db, { aggregateId: fileId })).filter((step) => step.type === "EVT-FileAttached"),
    ).toHaveLength(1);
  });

  it("rejects an unknown machine or machine model as a whole", async () => {
    await anExistingTeamMember(db, tom, "Tom");
    const [lg042] = await machinesOfOneModel(db, 1);
    const fileId = await aFile({});

    expect(await attach(fileId, { machineIds: [lg042.machineId, randomUUID()] })).toEqual({
      ok: false,
      error: "unknown-machine",
    });
    expect(await attach(fileId, { machineModelIds: [randomUUID()] })).toEqual({
      ok: false,
      error: "unknown-machine-model",
    });
    expect((await fileDetails(db, fileId))!.attachedTo).toEqual([]);
    expect(await versionOf(fileId)).toBe(0);
  });

  it("attaches a retired machine", async () => {
    await anExistingTeamMember(db, tom, "Tom");
    const [lg041] = await machinesOfOneModel(db, 1);
    await retireMachine(db, lg041.machineId);
    const fileId = await aFile({});

    expect(await attach(fileId, { machineIds: [lg041.machineId] })).toMatchObject({ ok: true });
    expect((await fileDetails(db, fileId))!.attachedTo).toEqual([
      expect.objectContaining({ kind: "machine", machineId: lg041.machineId, retired: true }),
    ]);
  });

  it("a removed file cannot be attached", async () => {
    await anExistingTeamMember(db, tom, "Tom");
    const [lg042] = await machinesOfOneModel(db, 1);
    const fileId = await aFile({});
    const removed = await executeCommand(removeFileCommand, { fileId, version: 0 }, { actor: tom, ...at() });
    if (!removed.ok) throw new Error(removed.error);
    const journal = await journalOf(db, { aggregateId: fileId });

    expect(await attach(fileId, { machineIds: [lg042.machineId] })).toEqual({ ok: false, error: "file-removed" });
    expect(await journalOf(db, { aggregateId: fileId })).toEqual(journal);
  });

  it("two attaches at the same moment both stand", async () => {
    await anExistingTeamMember(db, tom, "Tom");
    const [lg042, lg050] = await machinesOfOneModel(db, 2);
    const fileId = await aFile({});

    const { first, second } = await whileHoldingRow(
      db,
      sql`SELECT id FROM file WHERE id = ${fileId} FOR UPDATE`,
      async (untilWaiting) => {
        const first = attach(fileId, { machineIds: [lg042.machineId] });
        await untilWaiting(1);
        const second = attach(fileId, { machineIds: [lg050.machineId] });
        await untilWaiting(2);
        return { first, second };
      },
    );

    expect(await first).toMatchObject({ ok: true });
    expect(await second).toMatchObject({ ok: true });
    expect((await fileDetails(db, fileId))!.attachedTo).toHaveLength(2);
    expect(
      (await journalOf(db, { aggregateId: fileId })).filter((step) => step.type === "EVT-FileAttached"),
    ).toHaveLength(2);
  });

  it("two attaches to the same machine at the same moment both stand, with one event", async () => {
    await anExistingTeamMember(db, tom, "Tom");
    const [lg042] = await machinesOfOneModel(db, 1);
    const fileId = await aFile({});

    const { first, second } = await whileHoldingRow(
      db,
      sql`SELECT id FROM file WHERE id = ${fileId} FOR UPDATE`,
      async (untilWaiting) => {
        const first = attach(fileId, { machineIds: [lg042.machineId] });
        await untilWaiting(1);
        const second = attach(fileId, { machineIds: [lg042.machineId] });
        await untilWaiting(2);
        return { first, second };
      },
    );

    expect(await first).toMatchObject({ ok: true });
    expect(await second).toMatchObject({ ok: true });
    expect((await fileDetails(db, fileId))!.attachedTo).toHaveLength(1);
    expect(
      (await journalOf(db, { aggregateId: fileId })).filter((step) => step.type === "EVT-FileAttached"),
    ).toHaveLength(1);
  });
});
