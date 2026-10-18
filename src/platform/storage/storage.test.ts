import { describe, expect, it } from "vitest";
import { memoryStorage } from "./memory-storage";

/**
 * The storage seam (ST-016, architecture review Q8/Q16, ADR 0007): write, delete and a short-lived view address.
 * Shown with the in-memory adapter integration tests use; the Vercel Blob adapter is shown by the photo browser test.
 */
describe("the storage seam", () => {
  it("stores content under its name and gives view addresses valid until the given time", async () => {
    const storage = memoryStorage();

    await storage.write("problem-reports/a.jpg", new Uint8Array([1, 2, 3]), "image/jpeg");

    expect(storage.read("problem-reports/a.jpg")).toEqual({
      bytes: new Uint8Array([1, 2, 3]),
      contentType: "image/jpeg",
    });
    expect(await storage.viewAddresses(["problem-reports/a.jpg"], new Date("2026-10-04T10:05:00Z"))).toEqual(
      new Map([["problem-reports/a.jpg", "memory://problem-reports/a.jpg?valid-until=2026-10-04T10:05:00.000Z"]]),
    );
  });

  it("makes deleted content unreadable", async () => {
    const storage = memoryStorage();
    await storage.write("problem-reports/b.jpg", new Uint8Array([4]), "image/jpeg");

    await storage.delete("problem-reports/b.jpg");

    expect(storage.read("problem-reports/b.jpg")).toBeUndefined();
    expect(storage.names()).toEqual([]);
  });
});

/**
 * The upload address (ST-085, ADR 0009): a permission to upload content of at most a given size under exactly one
 * name, until a given time. The size limit is the caller's, and the permission itself refuses more.
 */
describe("an upload address", () => {
  const until = new Date("2026-10-18T10:30:00Z");

  it("lets the browser upload content of at most the given size under its name", async () => {
    const storage = memoryStorage();
    const address = await storage.uploadAddress("files/a", { maximumSize: 4, validUntil: until });

    await storage.upload(address, new Uint8Array([1, 2, 3, 4]), "application/pdf", new Date("2026-10-18T10:29:59Z"));

    expect(storage.read("files/a")).toEqual({ bytes: new Uint8Array([1, 2, 3, 4]), contentType: "application/pdf" });
  });

  it("refuses content above the size limit, whatever the form allowed", async () => {
    const storage = memoryStorage();
    const address = await storage.uploadAddress("files/b", { maximumSize: 4, validUntil: until });

    await expect(
      storage.upload(address, new Uint8Array([1, 2, 3, 4, 5]), "application/pdf", new Date("2026-10-18T10:00:00Z")),
    ).rejects.toThrow("too large");
    expect(storage.names()).toEqual([]);
  });

  it("refuses an upload after the address is no longer valid", async () => {
    const storage = memoryStorage();
    const address = await storage.uploadAddress("files/c", { maximumSize: 4, validUntil: until });

    await expect(
      storage.upload(address, new Uint8Array([1]), "application/pdf", new Date("2026-10-18T10:30:01Z")),
    ).rejects.toThrow("expired");
    expect(storage.names()).toEqual([]);
  });
});
