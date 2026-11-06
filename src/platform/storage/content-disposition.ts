/**
 * The name a downloaded or opened file gets (ST-119): the name the file had on the team member's device. It comes from a
 * browser, so it is typed text from outside – never a storage name, and made safe before it reaches a response header
 * or a page.
 */

const MAX_LENGTH = 200;

/**
 * The name as it may be shown and sent: only the last part of a path, no control characters (a line break would split
 * the header), at most 200 characters – none when nothing usable is left (empty, or only dots).
 */
export function safeFileName(name: string): string | undefined {
  const last = name.split(/[\\/]/).at(-1) ?? "";
  // Control characters (a line break would split the header) and invisible direction marks (they make "fdp.exe" read as
  // ".pdf") are removed.
  const cleaned = last.replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, "").trim();
  const shortened = shorten(cleaned).trim();
  return /^\.*$/.test(shortened) ? undefined : shortened;
}

/** At most 200 characters, counted by code points (never a half character), keeping a short ending such as ".pdf". */
function shorten(name: string): string {
  const characters = [...name];
  if (characters.length <= MAX_LENGTH) return name;
  const dot = name.lastIndexOf(".");
  const ending = dot > 0 ? [...name.slice(dot)] : [];
  const kept = ending.length > 0 && ending.length <= 16 ? ending : [];
  return characters.slice(0, MAX_LENGTH - kept.length).join("") + kept.join("");
}

/** RFC 5987 encoding of the extended parameter: everything but the unreserved characters is percent-encoded. */
const encodeExtended = (name: string) =>
  encodeURIComponent(name).replace(/['()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);

/**
 * The `Content-Disposition` for a file with a name (RFC 6266): `attachment` saves it, `inline` opens it in the
 * browser. The plain parameter is an ASCII fallback (no quote, backslash, percent sign or non-ASCII character), the
 * extended one carries the real name in UTF-8. None when the name leaves nothing usable.
 */
export function contentDisposition(kind: "attachment" | "inline", name: string): string | undefined {
  const safe = safeFileName(name);
  if (!safe) return undefined;
  // eslint-disable-next-line no-control-regex -- see above
  const fallback = safe.replace(/[^\u0020-\u007e]|["\\%]/g, "_");
  return `${kind}; filename="${fallback}"; filename*=UTF-8''${encodeExtended(safe)}`;
}
