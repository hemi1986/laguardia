import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { fixedClock } from "@/platform/clock";
import { executeCommand, type Actor } from "@/platform/command";
import { memoryStorage, type MemoryStorage } from "@/platform/storage";
import { testDatabase } from "@/test-support/database";
import { aRegisteredMachine } from "@/test-support/machines";
import { anExistingTeamMember } from "@/test-support/team-members";
import { recordPendingUpload, uploadAddressOf, withUploadedContent, type UploadOwner } from ".";
import { attachForTest, type AttachInput } from "./attach-stand-in.test-support";

/**
 * Attaching uploaded content (ST-085, ADR 0007 → 0009): the attaching step takes the pending upload – same owner,
 * younger than the fixed age of 24 hours – and runs the command with the content's name; a rejected or throwing
 * command deletes the content through the seam. Without such a pending upload the command does not run. A stand-in
 * command (CMD-AttachFile comes with ST-037) and the in-memory storage adapter.
 */
const db = testDatabase();
const uploadedAt = "2026-10-18T10:00:00Z";
const anna: Extract<Actor, { kind: "team-member" }> = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" };
let machineId: string;
let otherMachineId: string;

beforeAll(async () => {
  await anExistingTeamMember(db, anna);
  machineId = await aRegisteredMachine(db);
  otherMachineId = await aRegisteredMachine(db);
});

const at = (instant: string, storage: MemoryStorage) => ({ db, storage, clock: fixedClock(instant), newId: randomUUID });

/** A file Anna uploaded for the machine with the upload address she was given. */
async function anUploadedFile(storage: MemoryStorage, maximumSize?: number): Promise<string> {
  const pending = await recordPendingUpload(at(uploadedAt, storage), {
    issuedTo: anna.teamMemberId,
    owner: { machineId },
    maximumSize,
  });
  if (!pending.ok) throw new Error(pending.error);
  const address = await uploadAddressOf(at(uploadedAt, storage), { issuedTo: anna.teamMemberId, name: pending.name });
  await storage.upload(address!, new Uint8Array([1, 2, 3]), "application/pdf", new Date(uploadedAt));
  return pending.name;
}

function attach(storage: MemoryStorage, outcome: AttachInput["outcome"], { when = "2026-10-18T10:10:00Z", owner = { machineId } as UploadOwner } = {}) {
  return (name: string) =>
    withUploadedContent(at(when, storage), { name, owner }, (content) =>
      executeCommand(attachForTest, { content, outcome }, { actor: anna, db, clock: fixedClock(when), newId: randomUUID }),
    );
}

describe("attaching uploaded content", () => {
  it("runs the command with the uploaded content's name and keeps the content", async () => {
    const storage = memoryStorage();
    const name = await anUploadedFile(storage);

    expect(await attach(storage, "accept")(name)).toEqual({ ok: true, result: { content: name } });
    expect(storage.read(name)).toBeDefined();
  });

  it("ends the pending upload, so the same content is attached only once", async () => {
    const storage = memoryStorage();
    const name = await anUploadedFile(storage);
    await attach(storage, "accept")(name);

    expect(await attach(storage, "accept")(name)).toEqual({ ok: false, error: "content-gone" });
    expect(storage.read(name)).toBeDefined();
  });

  it("deletes the uploaded content when the command is rejected", async () => {
    const storage = memoryStorage();
    const name = await anUploadedFile(storage);

    expect(await attach(storage, "reject")(name)).toEqual({ ok: false, error: "rejected-for-test" });
    expect(storage.read(name)).toBeUndefined();
  });

  it("deletes the uploaded content when the command throws, and the error still reaches the caller", async () => {
    const storage = memoryStorage();
    const name = await anUploadedFile(storage);

    await expect(attach(storage, "throw")(name)).rejects.toThrow("the stand-in command failed");
    expect(storage.read(name)).toBeUndefined();
  });

  it("does not run the command for content no pending upload names", async () => {
    const storage = memoryStorage();

    expect(await attach(storage, "throw")(`files/${randomUUID()}`)).toEqual({ ok: false, error: "content-gone" });
  });

  it("does not run the command for another owner's content, and leaves that content alone", async () => {
    const storage = memoryStorage();
    const name = await anUploadedFile(storage);

    expect(await attach(storage, "throw", { owner: { machineId: otherMachineId } })(name)).toEqual({
      ok: false,
      error: "content-gone",
    });
    expect(storage.read(name)).toBeDefined();
    expect(await attach(storage, "accept")(name)).toEqual({ ok: true, result: { content: name } });
  });

  it("does not run the command once the pending upload is older than 24 hours", async () => {
    const storage = memoryStorage();
    const name = await anUploadedFile(storage);

    expect(await attach(storage, "throw", { when: "2026-10-19T10:00:00Z" })(name)).toEqual({
      ok: false,
      error: "content-gone",
    });
  });

  it("refuses content larger than the pending upload allowed and deletes it – Blob does not hold a multipart upload to the limit", async () => {
    const storage = memoryStorage();
    const name = await anUploadedFile(storage, 3);
    // What a multipart upload can leave behind: Blob checks the size limit only for an upload in one piece (ST-085).
    await storage.write(name, new Uint8Array(4), "application/pdf");

    expect(await attach(storage, "throw")(name)).toEqual({ ok: false, error: "too-large" });
    expect(storage.read(name)).toBeUndefined();
  });

  it("does not run the command when nothing was uploaded under the name", async () => {
    const storage = memoryStorage();
    const pending = await recordPendingUpload(at(uploadedAt, storage), { issuedTo: anna.teamMemberId, owner: { machineId } });
    if (!pending.ok) throw new Error(pending.error);

    expect(await attach(storage, "throw")(pending.name)).toEqual({ ok: false, error: "content-gone" });
  });
});
