import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { fixedClock } from "@/platform/clock";
import { createMachineModelCommand } from "@/modules/collection";
import { executeCommand, type Actor } from "@/platform/command";
import { memoryStorage } from "@/platform/storage";
import { testDatabase } from "@/test-support/database";
import { aRegisteredMachine } from "@/test-support/machines";
import { anExistingTeamMember } from "@/test-support/team-members";
import { eq } from "drizzle-orm";
import { FILE_SIZE_LIMIT, grantUploadAddress } from ".";
import { pendingUpload } from "./schema";

/**
 * The upload address (ST-085, ST-099, ADR 0009/0012): the server holds the declared size to the limit, names the
 * content, records it as a pending upload for one owner and the team member who asked, and only then signs a permission
 * for exactly that name, size and media type, valid for 30 minutes. The in-memory storage adapter shows what the
 * permission allows; real PostgreSQL holds the records.
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

const aPdf = (size: number, maximumSize?: number) => ({ size, contentType: "application/pdf", maximumSize });

async function pendingUploadsNamed(name: string) {
  return db.select().from(pendingUpload).where(eq(pendingUpload.name, name));
}

describe("the upload address", () => {
  it("is issued for a name the server chose, the declared size and media type, valid for 30 minutes", async () => {
    const storage = memoryStorage();
    const issued = await grantUploadAddress(at(issuedAt, storage), {
      issuedTo: anna.teamMemberId,
      owner: { machineId },
      ...aPdf(3),
    });
    if (!issued.ok) throw new Error(issued.error);

    expect(issued.name).toMatch(/^files\/[0-9a-f-]{36}$/);
    expect(issued.address.url).toBe(`memory://${issued.name}?upload-until=2026-10-18T10:30:00.000Z&size=3`);
    await storage.upload(issued.address, new Uint8Array(3), "application/pdf", new Date("2026-10-18T10:29:59Z"));
    expect(storage.read(issued.name)?.bytes).toHaveLength(3);
  });

  it("records the pending upload with its owner, team member, time, size limit and declared size", async () => {
    const issued = await grantUploadAddress(at(issuedAt), {
      issuedTo: anna.teamMemberId,
      owner: { machineId },
      ...aPdf(3),
    });
    if (!issued.ok) throw new Error(issued.error);

    expect(await pendingUploadsNamed(issued.name)).toEqual([
      {
        name: issued.name,
        machineId,
        machineModelId: null,
        issuedTo: anna.teamMemberId,
        issuedAt: new Date(issuedAt),
        maximumSize: FILE_SIZE_LIMIT,
        declaredSize: 3,
      },
    ]);
  });

  it("refuses a declared size above the size limit before recording or signing anything", async () => {
    const storage = memoryStorage();
    const names = () => db.select({ name: pendingUpload.name }).from(pendingUpload);
    const before = await names();

    const refused = await grantUploadAddress(at(issuedAt, storage), {
      issuedTo: anna.teamMemberId,
      owner: { machineId },
      ...aPdf(4, 3),
    });

    expect(refused).toEqual({ ok: false, error: "too-large" });
    expect(await names()).toEqual(before);
  });

  it("never allows more than the file size limit, whatever the request asks for", async () => {
    const declaredAboveTheLimit = await grantUploadAddress(at(issuedAt), {
      issuedTo: anna.teamMemberId,
      owner: { machineId },
      ...aPdf(FILE_SIZE_LIMIT + 1, FILE_SIZE_LIMIT * 2),
    });
    const atTheLimit = await grantUploadAddress(at(issuedAt), {
      issuedTo: anna.teamMemberId,
      owner: { machineId },
      ...aPdf(FILE_SIZE_LIMIT, FILE_SIZE_LIMIT * 2),
    });
    if (!atTheLimit.ok) throw new Error(atTheLimit.error);

    expect(declaredAboveTheLimit).toEqual({ ok: false, error: "too-large" });
    expect(await pendingUploadsNamed(atTheLimit.name)).toMatchObject([{ maximumSize: FILE_SIZE_LIMIT }]);
  });

  it("is no longer valid 30 minutes after it was issued", async () => {
    const storage = memoryStorage();
    const issued = await grantUploadAddress(at(issuedAt, storage), {
      issuedTo: anna.teamMemberId,
      owner: { machineId },
      ...aPdf(3),
    });
    if (!issued.ok) throw new Error(issued.error);

    await expect(
      storage.upload(issued.address, new Uint8Array(3), "application/pdf", new Date("2026-10-18T10:30:01Z")),
    ).rejects.toThrow("expired");
  });

  it("is recorded for a machine model as well", async () => {
    const machineModelId = await aMachineModel();

    const issued = await grantUploadAddress(at(issuedAt), {
      issuedTo: tom.teamMemberId,
      owner: { machineModelId },
      ...aPdf(3),
    });

    expect(issued.ok).toBe(true);
  });

  it("is not recorded for an owner that does not exist", async () => {
    expect(
      await grantUploadAddress(at(issuedAt), {
        issuedTo: anna.teamMemberId,
        owner: { machineId: randomUUID() },
        ...aPdf(3),
      }),
    ).toEqual({ ok: false, error: "unknown-owner" });
    expect(
      await grantUploadAddress(at(issuedAt), {
        issuedTo: anna.teamMemberId,
        owner: { machineModelId: randomUUID() },
        ...aPdf(3),
      }),
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
