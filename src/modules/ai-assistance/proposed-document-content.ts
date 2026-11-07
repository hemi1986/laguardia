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
  if (["application/pdf", "application/x-pdf", "application/octet-stream", "binary/octet-stream", ""].includes(mediaType)) {
    // A server that does not say what it sends is believed only when the content is a PDF; one that says PDF must send one.
    return looksLikePdf(bytes) ? { contentType: "application/pdf", bytes } : "not-pdf-or-text";
  }
  const decode = () => new TextDecoder(charsetOf(contentType)).decode(bytes);
  if (mediaType === "text/plain" || mediaType === "text/markdown" || mediaType === "text/x-markdown") {
    return bytes.length > 0
      ? { contentType: mediaType === "text/plain" ? "text/plain" : "text/markdown", bytes }
      : "not-pdf-or-text";
  }
  if (mediaType === "text/html" || mediaType === "application/xhtml+xml") {
    const text = textOfWebPage(decode());
    return text ? { contentType: "text/plain", bytes: new TextEncoder().encode(text) } : "not-pdf-or-text";
  }
  return "not-pdf-or-text";
}

const BLOCKS = "address|article|aside|blockquote|dd|details|div|dl|dt|fieldset|figcaption|figure|footer|form|h[1-6]|header|hr|li|main|nav|ol|p|pre|section|summary|table|tr|ul";

/** The text of a web page: its title, then the text of its body – no markup, scripts or styles. */
export function textOfWebPage(html: string): string {
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
  const body = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|template|svg|head|iframe|object|embed)\b[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(new RegExp(`</?(?:${BLOCKS})\\b[^>]*>|<br\\b[^>]*>`, "gi"), "\n")
    .replace(/<[^>]*>/g, " ");
  const lines = [title === undefined ? "" : decodeEntities(title), "", ...decodeEntities(body).split("\n")]
    .map((line) => line.replace(/[ \t\f\v ]+/g, " ").trim());
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

const NAMED: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decodeEntities(text: string): string {
  return text.replace(/&(?:#(\d+)|#x([0-9a-f]+)|([a-z]+));/gi, (whole, decimal, hex, name) => {
    if (name) return NAMED[name.toLowerCase()] ?? whole;
    const code = decimal ? Number(decimal) : parseInt(hex, 16);
    return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : whole;
  });
}
