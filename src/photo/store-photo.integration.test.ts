import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { fixedClock } from "@/platform/clock";
import { executeCommand, type Actor } from "@/platform/command";
import { memoryStorage } from "@/platform/storage";
import { testDatabase } from "@/test-support/database";
import { photoViewAddresses, withStoredPhoto } from ".";
import { techniciansOnlyWithPhotoForTest, withPhotoForTest, type WithPhotoInput } from "./photo-stand-in.test-support";

/**
 * The photo module's one way to store a photo (ST-016, architecture review Q7/Q17, ADR 0007): store the photo, run
 * the command with its reference, delete the photo if the command is rejected or throws. A stand-in command and the
 * in-memory storage adapter – never Vercel Blob.
 */
const db = testDatabase();
const clock = fixedClock("2026-10-04T10:00:00Z");
const visitor: Actor = { kind: "visitor" };
let ids = 0;
const newId = () => `00000000-0000-4000-8000-${String(++ids).padStart(12, "0")}`;

async function aPhoneJpeg(): Promise<Uint8Array> {
  return sharp({ create: { width: 640, height: 480, channels: 3, background: { r: 200, g: 120, b: 40 } } })
    .jpeg()
    .withExifMerge({ IFD0: { Make: "TestPhone" } })
    .toBuffer();
}

function storeAndRun(
  storage: ReturnType<typeof memoryStorage>,
  outcome: WithPhotoInput["outcome"],
  { actor = visitor, command = withPhotoForTest } = {},
) {
  return async (upload: Uint8Array | undefined) =>
    withStoredPhoto(upload, "problem-reports", { storage, newId }, (photo) =>
      executeCommand(command, { photo, outcome }, { actor, db, clock, newId }),
    );
}

describe("store, run, delete on failure", () => {
  it("stores the accepted photo and runs the command with exactly its reference", async () => {
    const storage = memoryStorage();

    const outcome = await storeAndRun(storage, "accept")(await aPhoneJpeg());

    expect(outcome.ok).toBe(true);
    const stored = storage.names();
    expect(stored).toHaveLength(1);
    expect(outcome).toEqual({ ok: true, result: { photo: stored[0] } });
    const photo = storage.read(stored[0])!;
    expect(photo.contentType).toBe("image/jpeg");
    expect((await sharp(photo.bytes).metadata()).exif).toBeUndefined();
  });

  it("runs the command without a photo when none was sent, and stores nothing", async () => {
    const storage = memoryStorage();

    expect(await storeAndRun(storage, "accept")(undefined)).toEqual({ ok: true, result: { photo: undefined } });
    expect(storage.names()).toEqual([]);
  });

  it("leaves no stored photo when the command is rejected", async () => {
    const storage = memoryStorage();

    expect(await storeAndRun(storage, "reject")(await aPhoneJpeg())).toEqual({ ok: false, error: "rejected-for-test" });
    expect(storage.names()).toEqual([]);
  });

  it("leaves no stored photo when the command throws, and the error still reaches the caller", async () => {
    const storage = memoryStorage();

    await expect(storeAndRun(storage, "throw")(await aPhoneJpeg())).rejects.toThrow("the stand-in command failed");
    expect(storage.names()).toEqual([]);
  });

  it("leaves no stored photo when the acting person is not authorized", async () => {
    const storage = memoryStorage();
    const run = storeAndRun(storage, "accept", { command: techniciansOnlyWithPhotoForTest });

    expect(await run(await aPhoneJpeg())).toEqual({ ok: false, error: "not-authorized" });
    expect(storage.names()).toEqual([]);
  });

  it("rejects content that is not a photo before anything is stored or run", async () => {
    const storage = memoryStorage();

    expect(await storeAndRun(storage, "accept")(new TextEncoder().encode("%PDF-1.7"))).toEqual({
      ok: false,
      error: "not-an-image",
    });
    expect(storage.names()).toEqual([]);
  });

  it("says the photo was not stored when the storage fails – and runs no command", async () => {
    const failing = { ...memoryStorage(), write: () => Promise.reject(new Error("Blob is down")) };
    let ran = false;

    const outcome = await withStoredPhoto(await aPhoneJpeg(), "problem-reports", { storage: failing, newId }, async () => {
      ran = true;
      return { ok: true, result: undefined };
    });

    expect(outcome).toEqual({ ok: false, error: "not-stored" });
    expect(ran).toBe(false);
  });

  it("names the photo with the injected ID generator and gives addresses valid for 5 minutes by the injected clock", async () => {
    const storage = memoryStorage();
    const fixedId = () => "11111111-1111-4111-8111-111111111111";

    await withStoredPhoto(await aPhoneJpeg(), "problem-reports", { storage, newId: fixedId }, async () => ({
      ok: true,
      result: undefined,
    }));

    expect(storage.names()).toEqual(["problem-reports/11111111-1111-4111-8111-111111111111.jpg"]);
    expect(await photoViewAddresses(storage, clock, storage.names())).toEqual(
      new Map([
        [
          "problem-reports/11111111-1111-4111-8111-111111111111.jpg",
          "memory://problem-reports/11111111-1111-4111-8111-111111111111.jpg?valid-until=2026-10-04T10:05:00.000Z",
        ],
      ]),
    );
  });
});
