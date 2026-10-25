import { describe, expect, it, vi } from "vitest";
import { deleteRemovedContent } from "./delete-removed-content";
import { memoryStorage } from "./memory-storage";

describe("deleting content a command removed on purpose", () => {
  it("deletes it from the storage", async () => {
    const storage = memoryStorage();
    await storage.write("files/a", new Uint8Array(3), "application/pdf");

    await deleteRemovedContent(storage, "files/a");

    expect(storage.read("files/a")).toBeUndefined();
  });

  it("only logs the stored name when the storage fails – the removal stands", async () => {
    const failing = { ...memoryStorage(), delete: async () => Promise.reject(new Error("Blob unavailable")) };
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(deleteRemovedContent(failing, "files/b")).resolves.toBeUndefined();

    expect(logged).toHaveBeenCalledWith("content not deleted, delete it by hand: files/b:", "Blob unavailable");
    logged.mockRestore();
  });
});
