import { describe, expect, it } from "vitest";
import { documentContent, textOfWebPage } from "./proposed-document-content";

const bytes = (text: string) => new TextEncoder().encode(text);

/** ST-129: what a fetched address becomes as a file – a PDF, a text or Markdown document, the text of a page – or nothing. */
describe("documentContent", () => {
  it("keeps a PDF, also one a server calls a binary stream, and refuses a stream that is none", () => {
    expect(documentContent("application/pdf", bytes("%PDF-1.4 …"))).toMatchObject({ contentType: "application/pdf" });
    expect(documentContent("application/octet-stream", bytes("%PDF-1.4 …"))).toMatchObject({ contentType: "application/pdf" });
    expect(documentContent("application/octet-stream", bytes("PK\u0003\u0004"))).toBe("not-pdf-or-text");
    // A server that says PDF must send one.
    expect(documentContent("application/pdf", bytes("<html>Please log in</html>"))).toBe("not-pdf-or-text");
  });

  it("keeps text and Markdown as they are", () => {
    expect(documentContent("text/plain; charset=utf-8", bytes("Hallo"))).toEqual({ contentType: "text/plain", bytes: bytes("Hallo") });
    expect(documentContent("text/x-markdown", bytes("# Hallo"))).toEqual({ contentType: "text/markdown", bytes: bytes("# Hallo") });
    expect(documentContent("text/plain", new Uint8Array())).toBe("not-pdf-or-text");
  });

  it.each(["application/zip", "image/png", "video/mp4", "application/json", "application/javascript"])(
    "refuses %s",
    (contentType) => {
      expect(documentContent(contentType, bytes("%PDF-1.4"))).toBe("not-pdf-or-text");
    },
  );

  it("turns a web page into its text, decoding the page's own character set", () => {
    const latin1 = Uint8Array.from([..."<p>Gr"].map((c) => c.charCodeAt(0)).concat(0xfc, ..."ße</p>".split("").map((c) => c.charCodeAt(0))));
    const content = documentContent("text/html; charset=iso-8859-1", latin1);
    expect(content).toMatchObject({ contentType: "text/plain" });
    expect(new TextDecoder().decode((content as { bytes: Uint8Array }).bytes)).toBe("Grüße");
  });
});

describe("textOfWebPage", () => {
  it("keeps the title and the text, drops code and markup, decodes entities and breaks at blocks", () => {
    const html = `<!doctype html><html><head><title>A &amp; B</title><script>evil()</script></head>
      <body><!-- hidden --><h1>Head</h1><p>One<br>two &lt;3 &#233; &#x41;</p><style>p{}</style><ul><li>x</li><li>y</li></ul></body></html>`;
    expect(textOfWebPage(html)).toBe("A & B\n\nHead\n\nOne\ntwo <3 é A\n\nx\n\ny");
  });

  it("is empty for a page without text", () => {
    expect(textOfWebPage("<html><head><script>x()</script></head><body> </body></html>")).toBe("");
  });
});
