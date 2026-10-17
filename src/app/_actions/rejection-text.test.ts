import { describe, expect, it } from "vitest";
import { teamMessages } from "@/platform/messages";
import { rejectionText } from "./rejection-text";

describe("rejectionText", () => {
  it("asks to send again after a conflict – the form kept what was typed", () => {
    expect(rejectionText("version-conflict")).toBe(teamMessages.forms.conflict);
  });

  it("shows the catalogue's text for any other error", () => {
    expect(rejectionText("closing-note-required")).toBe("Bitte kurz beschreiben, wie der Defekt behoben wurde.");
  });

  it("prefers a form's own text for an error", () => {
    expect(rejectionText("version-conflict", { "version-conflict": "Eigener Text." })).toBe("Eigener Text.");
    expect(rejectionText("not-found", { "version-conflict": "Eigener Text." })).toBe("Das gibt es nicht mehr.");
  });
});
