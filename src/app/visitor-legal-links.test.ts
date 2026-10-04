import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { visitorMessages, type LegalText, type VisitorMessages } from "@/platform/messages";
import { VisitorLegalLinks } from "./visitor-legal-links";

/**
 * The legal links every visitor page shows (ST-064). Whether the museum has provided an imprint is a state of the
 * catalogue, not of a database – so both states are rendered here with a catalogue that has or lacks one.
 */
const anImprint: LegalText = { title: "Impressum", sections: [{ heading: "Anbieter", paragraphs: ["Museum"] }] };

function withImprint(imprint: LegalText | null): VisitorMessages {
  const messages = visitorMessages("de");
  return { ...messages, legal: { ...messages.legal, imprint } };
}

function legalLinks(messages: VisitorMessages): string {
  return renderToStaticMarkup(createElement(VisitorLegalLinks, { messages }));
}

describe("legal links of the visitor pages", () => {
  it("ST-064: Imprint only if the museum provides one", () => {
    const withoutImprint = legalLinks(withImprint(null));
    expect(withoutImprint).toContain('href="/datenschutz"');
    expect(withoutImprint).not.toContain("/impressum");
    expect(withoutImprint).not.toContain("Impressum");

    // Once the museum provides one, it is offered.
    expect(legalLinks(withImprint(anImprint))).toMatch(/<a [^>]*href="\/impressum"[^>]*>Impressum<\/a>/);
  });
});
