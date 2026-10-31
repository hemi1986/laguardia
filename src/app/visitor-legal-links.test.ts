import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { visitorMessages } from "@/platform/messages";
import { VisitorLegalLinks } from "./visitor-legal-links";

/**
 * The legal links every visitor page shows (ST-064). Whether the museum provides an imprint is a state of the museum
 * settings (ST-103) that the page passes in – so both states are rendered here.
 */
function legalLinks(imprintProvided: boolean): string {
  return renderToStaticMarkup(createElement(VisitorLegalLinks, { messages: visitorMessages("de"), imprintProvided }));
}

describe("legal links of the visitor pages", () => {
  it("ST-064: Imprint only if the museum provides one", () => {
    const withoutImprint = legalLinks(false);
    expect(withoutImprint).toContain('href="/datenschutz"');
    expect(withoutImprint).not.toContain("/impressum");
    expect(withoutImprint).not.toContain("Impressum");

    // Once the museum provides one, it is offered.
    expect(legalLinks(true)).toMatch(/<a [^>]*href="\/impressum"[^>]*>Impressum<\/a>/);
  });
});
