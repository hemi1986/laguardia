/**
 * What a fetched web address becomes as a file (ST-129, ADR 0019 decision 3): a PDF as it is, a text or Markdown document
 * as it is, a web page as the text of the page – anything else is *no PDF or text*. Nothing of the content is executed or
 * interpreted beyond reading its text: scripts, styles and markup of a page are dropped, never run.
 */

export type DocumentContent = { contentType: "application/pdf" | "text/plain" | "text/markdown"; bytes: Uint8Array };

const mediaTypeOf = (contentType: string) => contentType.split(";")[0].trim().toLowerCase();

/** A PDF starts with „%PDF-“ within its first kilobyte (the standard allows some leading bytes). */
function looksLikePdf(bytes: Uint8Array): boolean {
  const start = new TextDecoder("latin1").decode(bytes.subarray(0, 1024));
  return start.includes("%PDF-");
}

function charsetOf(contentType: string): string {
  const label = /charset\s*=\s*"?([\w.:-]+)"?/i.exec(contentType)?.[1] ?? "utf-8";
  try {
    new TextDecoder(label);
    return label;
  } catch {
    return "utf-8";
  }
}

export function documentContent(contentType: string, bytes: Uint8Array): DocumentContent | "not-pdf-or-text" {
  const mediaType = mediaTypeOf(contentType);
  if (
    ["application/pdf", "application/x-pdf", "application/octet-stream", "binary/octet-stream", ""].includes(mediaType)
  ) {
    // A server that does not say what it sends is believed only when the content is a PDF; one that says PDF must send one.
    return looksLikePdf(bytes) ? { contentType: "application/pdf", bytes } : "not-pdf-or-text";
  }
  const decode = () => new TextDecoder(charsetOf(contentType)).decode(bytes);
  if (mediaType === "text/plain" || mediaType === "text/markdown" || mediaType === "text/x-markdown") {
    if (bytes.length === 0) return "not-pdf-or-text";
    // Stored as UTF-8, whatever the server declared – a Latin-1 file must not read garbled.
    const utf8 = charsetOf(contentType).toLowerCase().replace("_", "-") === "utf-8";
    return {
      contentType: mediaType === "text/plain" ? "text/plain" : "text/markdown",
      bytes: utf8 ? bytes : new TextEncoder().encode(decode()),
    };
  }
  if (mediaType === "text/html" || mediaType === "application/xhtml+xml") {
    const text = textOfWebPage(decode());
    return text ? { contentType: "text/plain", bytes: new TextEncoder().encode(text) } : "not-pdf-or-text";
  }
  return "not-pdf-or-text";
}

const BLOCKS = new Set(
  "address article aside blockquote br dd details div dl dt fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 header hr li main nav ol p pre section summary table tr ul".split(
    " ",
  ),
);
/** Elements whose content is code or hidden – dropped up to their closing tag. */
const DROPPED = new Set(["script", "style", "noscript", "template", "svg", "head", "iframe", "object", "embed"]);

/**
 * The text of a web page: its title, then the text of its body – no markup, scripts or styles. One linear scan (a page may be
 * 100 MB and hostile: `<<<<…` or an unclosed comment must not cost more than the page's length).
 */
export function textOfWebPage(html: string): string {
  const lower = html.toLowerCase();
  const titleStart = lower.indexOf("<title");
  const titleOpenEnd = titleStart < 0 ? -1 : lower.indexOf(">", titleStart);
  const titleEnd = titleOpenEnd < 0 ? -1 : lower.indexOf("</title", titleOpenEnd);
  const title = titleEnd < 0 ? "" : html.slice(titleOpenEnd + 1, titleEnd);
  const lastClose = html.lastIndexOf(">");
  const out: string[] = [];
  let at = 0;
  while (at < html.length) {
    const open = html.indexOf("<", at);
    if (open < 0) {
      out.push(html.slice(at));
      break;
    }
    out.push(html.slice(at, open));
    if (html.startsWith("<!--", open)) {
      const end = html.indexOf("-->", open + 4);
      at = end < 0 ? html.length : end + 3;
      continue;
    }
    const next = html[open + 1] ?? "";
    // Only „<name“, „</name“ and „<!…“ start markup; any other „<“ is text – and with no „>“ left nothing can close.
    if (!/[a-zA-Z/!?]/.test(next) || open > lastClose) {
      out.push("<");
      at = open + 1;
      continue;
    }
    const close = html.indexOf(">", open + 1);
    const name = /^\/?([a-z][a-z0-9]*)/.exec(lower.slice(open + 1, open + 40))?.[1] ?? "";
    at = close + 1;
    if (DROPPED.has(name) && next !== "/") {
      const end = lower.indexOf(`</${name}`, at);
      if (end < 0) break;
      const endClose = html.indexOf(">", end);
      at = endClose < 0 ? html.length : endClose + 1;
      out.push(" ");
      continue;
    }
    out.push(BLOCKS.has(name) ? "\n" : " ");
  }
  const lines = [decodeEntities(title), "", ...decodeEntities(out.join("")).split("\n")].map((line) =>
    line.replace(/[ \t\f\v\u00a0]+/g, " ").trim(),
  );
  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const NAMED: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decodeEntities(text: string): string {
  return text.replace(/&(?:#(\d+)|#x([0-9a-f]+)|([a-z]+));/gi, (whole, decimal, hex, name) => {
    if (name) return NAMED[name.toLowerCase()] ?? whole;
    const code = decimal ? Number(decimal) : parseInt(hex, 16);
    return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : whole;
  });
}
