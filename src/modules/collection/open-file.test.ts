import { describe, expect, it } from "vitest";
import { opensInBrowser } from "./open-file";

/** ST-037: PDFs and images can be opened in the browser; every other format is always downloaded. */
describe("which files open in the browser", () => {
  it.each([
    ["application/pdf", true],
    ["image/jpeg", true],
    ["image/png", true],
    ["image/webp", true],
    ["image/gif", true],
    ["IMAGE/PNG", true],
    ["application/pdf; charset=binary", true],
    // An SVG image can carry script – it is saved, never opened.
    ["image/svg+xml", false],
    ["text/html", false],
    ["application/octet-stream", false],
    ["application/zip", false],
    ["", false],
  ])("%s → %s", (contentType, opens) => {
    expect(opensInBrowser(contentType)).toBe(opens);
  });
});
