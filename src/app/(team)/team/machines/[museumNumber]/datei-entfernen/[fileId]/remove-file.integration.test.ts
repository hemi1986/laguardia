import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { attachFileCommand, machineRecord, removeFileCommand } from "@/modules/collection";
import { formRunner } from "@/app/_actions/form-runner";
import { fixedClock } from "@/platform/clock";
import { executeCommand, journalOf } from "@/platform/command";
import { memoryStorage } from "@/platform/storage";
import { testDatabase } from "@/test-support/database";
import { post } from "@/test-support/forms";
import { aRegisteredMachine } from "@/test-support/machines";
import { anExistingTeamMember } from "@/test-support/team-members";
import { removeFileForm } from "./remove-file-form";

/**
 * The form behind „Endgültig entfernen“ (ST-038): the runner (`formRunner`) with the form's definition, against real
 * PostgreSQL and the in-memory storage adapter – the content is deleted from the storage after the commit.
 */
const db = testDatabase();
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const removedAt = "2026-10-25T10:05:00Z";
let machineId: string;
let museumNumber: string;

beforeAll(async () => {
  await anExistingTeamMember(db, tom);
  machineId = await aRegisteredMachine(db);
  const [registered] = await journalOf(db, { aggregateId: machineId });
  museumNumber = registered.data.museumNumber as string;
});

/** A file of the machine's model whose content is in the storage; returns its ID and its content's name. */
async function aStoredFile(storage: ReturnType<typeof memoryStorage>, title: string) {
  const content = `files/${randomUUID()}`;
  await storage.write(content, new Uint8Array(3), "application/pdf");
  const attached = await executeCommand(
    attachFileCommand,
    {
      machineId,
      attachTo: "machine-model",
      title,
      fileCategory: "manual",
      content: { name: content, size: 3, contentType: "application/pdf" },
    },
    { actor: tom, db, clock: fixedClock("2026-10-18T10:00:00Z"), newId: randomUUID },
  );
  if (!attached.ok) throw new Error(attached.error);
  return { fileId: attached.result.fileId, content };
}

function sendForm(storage: ReturnType<typeof memoryStorage>, fileId: string) {
  const done: string[] = [];
  const action = formRunner({
    currentPerson: async () => tom,
    db,
    clock: fixedClock(removedAt),
    newId: randomUUID,
    storage,
  })(
    removeFileCommand,
    removeFileForm(fileId, async () => void done.push(fileId)),
  );
  return { done, send: (fields: Record<string, string>) => action(null, post(fields)) };
}

const titles = async () => (await machineRecord(db, museumNumber))!.files.map((file) => file.title);

describe("the form that removes a file", () => {
  it("ST-038: Technician removes a file", async () => {
    const storage = memoryStorage();
    const { fileId, content } = await aStoredFile(storage, "MM Manual (wrong edition)");
    const form = sendForm(storage, fileId);

    expect(await form.send({ version: "0" })).toBeNull();

    expect(form.done).toEqual([fileId]);
    expect(await titles()).not.toContain("MM Manual (wrong edition)");
    expect(storage.read(content)).toBeUndefined();
    expect((await journalOf(db, { aggregateId: fileId })).at(-1)).toMatchObject({
      type: "EVT-FileRemoved",
      aggregate: { type: "AGG-File", id: fileId },
      actor: { kind: "team-member", teamMemberId: tom.teamMemberId },
      occurredAt: new Date(removedAt),
    });
  });

  it("keeps the content when the file changed since the page showed it", async () => {
    const storage = memoryStorage();
    const { fileId, content } = await aStoredFile(storage, "MM Flyer (kept)");

    expect(await sendForm(storage, fileId).send({ version: "4" })).toMatchObject({ error: "version-conflict" });
    expect(await titles()).toContain("MM Flyer (kept)");
    expect(storage.read(content)).toBeDefined();
  });
});
