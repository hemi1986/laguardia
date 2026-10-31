import { describe, expect, it } from "vitest";
import { legalTextHtml } from "./legal-markdown";

/**
 * The legal texts' Markdown (ST-103, ADR 0013): visitors see headings, paragraphs, bold and italic, lists and links to
 * https and mailto addresses; anything else appears as its source, as typed – never as an element.
 */
const tagsIn = (html: string) => [...html.matchAll(/<([a-z][a-z0-9]*)\b/g)].map((match) => match[1]);

describe("rendering a legal text", () => {
  it("shows the allowed elements, its headings one level below the page's title", () => {
    const html = legalTextHtml(
      "# Verantwortlich\n\nDas **Museum** und *wir*.\n\n## Rechte\n\n- eins\n- zwei\n\n1. erstens\n\n[Kontakt](https://flippermuseum-eschbach.de/kontakt) oder [Mail](mailto:info@example.org)",
    );

    expect(html).toContain("<h2>Verantwortlich</h2>");
    expect(html).toContain("<h3>Rechte</h3>");
    expect(html).toContain("<strong>Museum</strong>");
    expect(html).toContain("<em>wir</em>");
    expect(html).toContain("<ul>\n<li>eins</li>");
    expect(html).toContain("<ol>\n<li>erstens</li>");
    expect(html).toContain('<a href="https://flippermuseum-eschbach.de/kontakt">Kontakt</a>');
    expect(html).toContain('<a href="mailto:info@example.org">Mail</a>');
    expect(html).not.toContain("<h1");
  });

  it("keeps the deepest heading a heading", () => {
    expect(legalTextHtml("###### Klein")).toBe("<h6>Klein</h6>\n");
  });

  it.each([
    ["raw HTML", "<script>alert(1)</script>", "&lt;script&gt;alert(1)&lt;/script&gt;"],
    [
      "inline HTML",
      'Text <img src="x" onerror="alert(1)">',
      "Text &lt;img src=&quot;x&quot; onerror=&quot;alert(1)&quot;&gt;",
    ],
    ["an image", "![Bild](x.png)", "![Bild](x.png)"],
    ["an image from an https address", "![Bild](https://example.org/x.png)", "![Bild](https://example.org/x.png)"],
    ["a javascript: link", "[Klick](javascript:alert(1))", "[Klick](javascript:alert(1))"],
    ["an http link", "[Alt](http://example.org)", "[Alt](http://example.org)"],
    ["a relative link", "[Impressum](/impressum)", "[Impressum](/impressum)"],
    ["a data: link", "[x](data:text/html;base64,PHNjcmlwdD4=)", "[x](data:text/html;base64,PHNjcmlwdD4=)"],
    ["a javascript: autolink", "<javascript:alert(1)>", "&lt;javascript:alert(1)&gt;"],
    ["a javascript: reference link", "[Klick][x]\n\n[x]: javascript:alert(1)", "[Klick][x]"],
    ["an https reference link", "[Klick][x]\n\n[x]: https://example.org", "[x]: https://example.org"],
    ["a reference image", "![Bild][x]\n\n[x]: https://example.org/x.png", "![Bild][x]"],
    ["a table", "| Zweck | Dauer |\n| --- | --- |\n| Meldung | 1 Jahr |", "| Zweck | Dauer |"],
    ["a quotation", "> zitiert", "&gt; zitiert"],
    ["code", "`code`", "`code`"],
    ["a fenced block", "```\nx\n```", "```\nx\n```"],
    ["a rule", "---", "---"],
    ["a crossed-out word", "~~weg~~", "~~weg~~"],
  ])("shows %s as its source", (_case, markdown, shown) => {
    const html = legalTextHtml(markdown);

    expect(html).toContain(shown);
    expect(tagsIn(html).every((tag) => ["p", "br"].includes(tag))).toBe(true);
  });

  it("leaves bare addresses as text", () => {
    expect(legalTextHtml("www.example.org und https://example.org")).toBe(
      "<p>www.example.org und https://example.org</p>\n",
    );
  });

  it("allows a link to an https address written in capitals, and an https autolink", () => {
    expect(legalTextHtml("[x](HTTPS://example.org) <https://example.org>")).toBe(
      '<p><a href="HTTPS://example.org">x</a> <a href="https://example.org">https://example.org</a></p>\n',
    );
  });
});

describe("an image inside an allowed link", () => {
  it("is the link's text, as typed", () => {
    expect(legalTextHtml("[![Bild](https://example.org/x.png)](https://example.org)")).toBe(
      '<p><a href="https://example.org">![Bild](https://example.org/x.png)</a></p>\n',
    );
  });
});
