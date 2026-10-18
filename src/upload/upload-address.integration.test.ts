import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { fixedClock } from "@/platform/clock";
import { createMachineModelCommand } from "@/modules/collection";
import { executeCommand, type Actor } from "@/platform/command";
import { memoryStorage } from "@/platform/storage";
import { testDatabase } from "@/test-support/database";
import { aRegisteredMachine } from "@/test-support/machines";
import { anExistingTeamMember } from "@/test-support/team-members";
import { FILE_SIZE_LIMIT, recordPendingUpload, uploadAddressOf } from ".";

/**
 * The upload address (ST-085, ADR 0009): the server names the content, records it as a pending upload for one owner
 * and the team member who asked, and only then signs a permission for exactly that name – limited in size and valid
 * for 30 minutes. The in-memory storage adapter shows what the permission allows; real PostgreSQL holds the records.
 */
const db = testDatabase();
const issuedAt = "2026-10-18T10:00:00Z";
const anna: Extract<Actor, { kind: "team-member" }> = {
  kind: "team-member",
  teamMemberId: randomUUID(),
  role: "helper",
};
const tom: Extract<Actor, { kind: "team-member" }> = {
  kind: "team-member",
  teamMemberId: randomUUID(),
  role: "technician",
};
let machineId: string;

beforeAll(async () => {
  await anExistingTeamMember(db, anna);
  await anExistingTeamMember(db, tom);
  machineId = await aRegisteredMachine(db);
});

const at = (instant: string, storage = memoryStorage()) => ({
  db,
  storage,
  clock: fixedClock(instant),
  newId: randomUUID,
});

describe("the upload address", () => {
  it("is issued for a name the server chose, limited to the file size limit and valid for 30 minutes", async () => {
    const storage = memoryStorage();
    const pending = await recordPendingUpload(at(issuedAt, storage), {
      issuedTo: anna.teamMemberId,
      owner: { machineId },
    });
    if (!pending.ok) throw new Error(pending.error);

    expect(pending.name).toMatch(/^files\/[0-9a-f-]{36}$/);
    expect(
      await uploadAddressOf(at("2026-10-18T10:05:00Z", storage), { issuedTo: anna.teamMemberId, name: pending.name }),
    ).toEqual({
      name: pending.name,
      maximumSize: FILE_SIZE_LIMIT,
      validUntil: "2026-10-18T10:30:00.000Z",
    });
  });

  it("refuses content above the size limit by the permission itself", async () => {
    const storage = memoryStorage();
    const pending = await recordPendingUpload(at(issuedAt, storage), {
      issuedTo: anna.teamMemberId,
      owner: { machineId },
      maximumSize: 3,
    });
    if (!pending.ok) throw new Error(pending.error);
    const address = await uploadAddressOf(at(issuedAt, storage), { issuedTo: anna.teamMemberId, name: pending.name });

    await expect(storage.upload(address!, new Uint8Array(4), "application/pdf", new Date(issuedAt))).rejects.toThrow(
      "too large",
    );
    await storage.upload(address!, new Uint8Array(3), "application/pdf", new Date(issuedAt));
    expect(storage.read(pending.name)?.bytes).toHaveLength(3);
  });

  it("never allows more than the file size limit, whatever the request asks for", async () => {
    const pending = await recordPendingUpload(at(issuedAt), {
      issuedTo: anna.teamMemberId,
      owner: { machineId },
      maximumSize: FILE_SIZE_LIMIT * 2,
    });
    if (!pending.ok) throw new Error(pending.error);

    expect(await uploadAddressOf(at(issuedAt), { issuedTo: anna.teamMemberId, name: pending.name })).toMatchObject({
      maximumSize: FILE_SIZE_LIMIT,
    });
  });

  it("is issued only to the team member the pending upload was recorded for, and only for 30 minutes", async () => {
    const pending = await recordPendingUpload(at(issuedAt), { issuedTo: anna.teamMemberId, owner: { machineId } });
    if (!pending.ok) throw new Error(pending.error);

    expect(await uploadAddressOf(at(issuedAt), { issuedTo: tom.teamMemberId, name: pending.name })).toBeUndefined();
    expect(
      await uploadAddressOf(at(issuedAt), { issuedTo: anna.teamMemberId, name: "files/someone-elses" }),
    ).toBeUndefined();
    expect(
      await uploadAddressOf(at("2026-10-18T10:30:01Z"), { issuedTo: anna.teamMemberId, name: pending.name }),
    ).toBeUndefined();
  });

  it("is recorded for a machine model as well", async () => {
    const machineModelId = await aMachineModel();

    const pending = await recordPendingUpload(at(issuedAt), { issuedTo: tom.teamMemberId, owner: { machineModelId } });

    expect(pending.ok).toBe(true);
  });

  it("is not recorded for an owner that does not exist", async () => {
    expect(
      await recordPendingUpload(at(issuedAt), { issuedTo: anna.teamMemberId, owner: { machineId: randomUUID() } }),
    ).toEqual({ ok: false, error: "unknown-owner" });
    expect(
      await recordPendingUpload(at(issuedAt), { issuedTo: anna.teamMemberId, owner: { machineModelId: randomUUID() } }),
    ).toEqual({ ok: false, error: "unknown-owner" });
  });
});

async function aMachineModel(): Promise<string> {
  const created = await executeCommand(
    createMachineModelCommand,
    { title: `Upload model ${randomUUID().slice(0, 8)}`, manufacturer: "Bally", machineCategory: "pinball" },
    { actor: tom, db, newId: randomUUID },
  );
  if (!created.ok) throw new Error(created.error);
  return created.result.machineModelId;
}
