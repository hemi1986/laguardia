import { describe, expect, it } from "vitest";
import { memoryStorage } from "./memory-storage";

/**
 * The storage seam (ST-016, architecture review Q8/Q16, ADR 0007): write, delete and a short-lived view address.
 * Shown with the in-memory adapter integration tests use; the S3 adapter has its own tests against SeaweedFS.
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

  it("tells the size and media type of stored content, and nothing for content that is not stored", async () => {
    const storage = memoryStorage();
    await storage.write("files/d", new Uint8Array([1, 2, 3]), "application/pdf");

    expect(await storage.details("files/d")).toEqual({ size: 3, contentType: "application/pdf" });
    expect(await storage.details("files/never")).toBeUndefined();
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
 * The upload address (ST-085, ST-099, ADR 0009/0012): a permission to upload content of exactly the declared size and
 * media type under exactly one name, once, until a given time – the in-memory adapter refuses what the S3 store refuses.
 */
describe("an upload address", () => {
  const until = new Date("2026-10-18T10:30:00Z");
  const before = new Date("2026-10-18T10:29:59Z");
  const declared = { size: 4, contentType: "application/pdf", validUntil: until };

  it("lets the browser upload content of the declared size and media type under its name", async () => {
    const storage = memoryStorage();
    const address = await storage.uploadAddress("files/a", declared);

    await storage.upload(address, new Uint8Array([1, 2, 3, 4]), "application/pdf", before);

    expect(storage.read("files/a")).toEqual({ bytes: new Uint8Array([1, 2, 3, 4]), contentType: "application/pdf" });
    expect(address.headers).toEqual({ "Content-Type": "application/pdf", "If-None-Match": "*" });
  });

  it("refuses content of another length or media type than declared", async () => {
    const storage = memoryStorage();
    const address = await storage.uploadAddress("files/b", declared);

    await expect(storage.upload(address, new Uint8Array(5), "application/pdf", before)).rejects.toThrow("length");
    await expect(storage.upload(address, new Uint8Array(4), "text/html", before)).rejects.toThrow("media type");
    expect(storage.names()).toEqual([]);
  });

  it("stores content under its name only once", async () => {
    const storage = memoryStorage();
    const address = await storage.uploadAddress("files/e", declared);
    await storage.upload(address, new Uint8Array([1, 2, 3, 4]), "application/pdf", before);

    await expect(storage.upload(address, new Uint8Array(4), "application/pdf", before)).rejects.toThrow("already");
    expect(storage.read("files/e")?.bytes).toEqual(new Uint8Array([1, 2, 3, 4]));
  });

  it("refuses an upload after the address is no longer valid", async () => {
    const storage = memoryStorage();
    const address = await storage.uploadAddress("files/c", declared);

    await expect(
      storage.upload(address, new Uint8Array(4), "application/pdf", new Date("2026-10-18T10:30:01Z")),
    ).rejects.toThrow("expired");
    expect(storage.names()).toEqual([]);
  });
});
