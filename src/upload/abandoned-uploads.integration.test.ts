import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { fixedClock } from "@/platform/clock";
import type { Actor } from "@/platform/command";
import { memoryStorage, type MemoryStorage } from "@/platform/storage";
import { isolatedTestDatabase } from "@/test-support/isolated-database";
import { aRegisteredMachine } from "@/test-support/machines";
import { anExistingTeamMember } from "@/test-support/team-members";
import { cleanUpAbandonedUploads, recordPendingUpload, uploadAddressOf, withUploadedContent } from ".";

/**
 * Abandoned uploads (ST-085, ADR 0009): content uploaded from the browser whose form was never sent. After a later
 * request, pending uploads older than the fixed age of 24 hours are deleted with their content; younger ones stay.
 * A rule over all pending uploads, so a database of its own; the injected clock and the in-memory storage adapter.
 */
const isolated = isolatedTestDatabase("abandoned_uploads");
let db: NodePgDatabase;
const anna: Extract<Actor, { kind: "team-member" }> = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" };
let machineId: string;

beforeAll(async () => {
  db = await isolated.reset();
  await anExistingTeamMember(db, anna);
  machineId = await aRegisteredMachine(db);
});
afterAll(() => isolated.close());
beforeEach(async () => {
  await db.execute(sql`DELETE FROM pending_upload`);
});

const at = (instant: string, storage: MemoryStorage) => ({ db, storage, clock: fixedClock(instant), newId: randomUUID });

/** A file Anna uploaded at the given time and never attached. */
async function uploadedAt(instant: string, storage: MemoryStorage): Promise<string> {
  const pending = await recordPendingUpload(at(instant, storage), { issuedTo: anna.teamMemberId, owner: { machineId } });
  if (!pending.ok) throw new Error(pending.error);
  const address = await uploadAddressOf(at(instant, storage), { issuedTo: anna.teamMemberId, name: pending.name });
  await storage.upload(address!, new Uint8Array([7]), "application/pdf", new Date(instant));
  return pending.name;
}

const now = "2026-10-19T12:00:00Z";

describe("cleaning up abandoned uploads", () => {
  it("deletes the content of a pending upload older than 24 hours and keeps a younger one", async () => {
    const storage = memoryStorage();
    const abandoned = await uploadedAt("2026-10-18T11:59:59Z", storage);
    const young = await uploadedAt("2026-10-18T12:00:01Z", storage);

    await cleanUpAbandonedUploads(at(now, storage));

    expect(storage.read(abandoned)).toBeUndefined();
    expect(storage.read(young)).toBeDefined();
    const attached = await withUploadedContent(at(now, storage), { name: young, owner: { machineId } }, async (content) => ({
      ok: true as const,
      result: content,
    }));
    expect(attached).toEqual({ ok: true, result: young });
  });

  it("keeps a pending upload whose content could not be deleted, and deletes it on the next request", async () => {
    const storage = memoryStorage();
    const abandoned = await uploadedAt("2026-10-17T09:00:00Z", storage);
    const failing = { ...storage, delete: () => Promise.reject(new Error("Blob is down")) };

    await cleanUpAbandonedUploads({ ...at(now, storage), storage: failing });
    expect(storage.read(abandoned)).toBeDefined();

    await cleanUpAbandonedUploads(at(now, storage));
    expect(storage.read(abandoned)).toBeUndefined();
  });

  it("deletes at most the given number per request, the oldest first", async () => {
    const storage = memoryStorage();
    const oldest = await uploadedAt("2026-10-16T09:00:00Z", storage);
    const older = await uploadedAt("2026-10-17T09:00:00Z", storage);
    const old = await uploadedAt("2026-10-18T09:00:00Z", storage);

    await cleanUpAbandonedUploads(at(now, storage), { atMost: 2 });

    expect([oldest, older, old].map((name) => storage.read(name) !== undefined)).toEqual([false, false, true]);
  });
});
