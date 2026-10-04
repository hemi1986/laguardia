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

    expect(storage.read("problem-reports/a.jpg")).toEqual({ bytes: new Uint8Array([1, 2, 3]), contentType: "image/jpeg" });
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
