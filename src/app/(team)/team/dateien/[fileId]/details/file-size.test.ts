import { describe, expect, it } from "vitest";
import { originValue } from "./file-origin";
import { fileSizeText } from "./file-size";

describe("what the file details say of a size and an origin (ST-114)", () => {
  it("reads a size in German notation (G13)", () => {
    expect(fileSizeText(Math.round(12.4 * 1024 * 1024))).toBe("12,4 MB");
    expect(fileSizeText(1024 * 1024)).toBe("1,0 MB");
    expect(fileSizeText(340 * 1024)).toBe("340 KB");
    expect(fileSizeText(120)).toBe("120 Byte");
  });

  it("writes an origin into an address – only the closed set", () => {
    expect(originValue({ machine: "LG-042" })).toBe("machine:LG-042");
    expect(originValue("settings")).toBe("settings");
    expect(originValue({ kind: "none" })).toBeUndefined();
    expect(originValue(undefined)).toBeUndefined();
  });
});
