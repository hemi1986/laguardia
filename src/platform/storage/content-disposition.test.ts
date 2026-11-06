import { describe, expect, it } from "vitest";
import { contentDisposition, safeFileName } from "./content-disposition";

describe("the file name of a download (ST-119)", () => {
  it("keeps a plain name and says it in both forms of RFC 6266", () => {
    expect(contentDisposition("attachment", "medieval_manual-v2.pdf")).toBe(
      `attachment; filename="medieval_manual-v2.pdf"; filename*=UTF-8''medieval_manual-v2.pdf`,
    );
    expect(contentDisposition("inline", "wiring.pdf")).toBe(
      `inline; filename="wiring.pdf"; filename*=UTF-8''wiring.pdf`,
    );
  });

  it("carries a name with umlauts as UTF-8 and an ASCII fallback", () => {
    expect(contentDisposition("attachment", "Bedienungsanleitung Flipper Größe.pdf")).toBe(
      `attachment; filename="Bedienungsanleitung Flipper Gr__e.pdf"; filename*=UTF-8''Bedienungsanleitung%20Flipper%20Gr%C3%B6%C3%9Fe.pdf`,
    );
  });

  it.each([
    ["a quote", 'a"b.pdf', 'a"b.pdf'],
    ["a backslash", "a\\b.pdf", "b.pdf"],
    ["a line break", "a\r\nSet-Cookie: x=1.pdf", "aSet-Cookie: x=1.pdf"],
    ["a path", "../../etc/passwd", "passwd"],
    ["a windows path", "C:\\Users\\anna\\manual.pdf", "manual.pdf"],
    ["a control character", "a\u0000b\u001f.pdf", "ab.pdf"],
    ["a percent sign", "100%.pdf", "100%.pdf"],
  ])("makes %s harmless", (_what, name, safe) => {
    const header = contentDisposition("attachment", name)!;
    expect(header).not.toMatch(/[\r\n]/);
    expect(safeFileName(name)).toBe(safe);
    // Whatever the name, the quoted part holds exactly one quoted string.
    expect(header.match(/"/g)).toHaveLength(2);
  });

  it.each(["", "   ", ".", "..", "/", "a/", "\u0000"])("has no name for %j", (name) => {
    expect(safeFileName(name)).toBeUndefined();
    expect(contentDisposition("attachment", name)).toBeUndefined();
  });

  it("shortens a very long name and keeps its ending", () => {
    const name = safeFileName("x".repeat(500) + ".pdf")!;
    expect(name.length).toBeLessThanOrEqual(200);
    expect(name.endsWith(".pdf")).toBe(true);
  });

  it("never cuts a character in half", () => {
    const header = contentDisposition("inline", "x".repeat(199) + "😀😀.pdf");
    expect(header).toBeDefined();
    expect(() => decodeURIComponent(header!.split("UTF-8''")[1])).not.toThrow();
    expect(contentDisposition("inline", "x".repeat(199) + "😀" + "y".repeat(300))).toBeDefined();
  });

  it("removes invisible direction marks that disguise an ending", () => {
    expect(safeFileName("manual\u202Efdp.exe")).toBe("manualfdp.exe");
    expect(safeFileName("a\u200Bb.pdf")).toBe("ab.pdf");
  });
});
