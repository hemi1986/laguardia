/**
 * The design of a page (ST-090, UX guideline G26): dark, unless the page follows the device's choice and the device was
 * switched to light. The system setting (`prefers-color-scheme`) is never followed.
 * - the team pages, the login and a team page address that leads nowhere follow the device's choice;
 * - the QR sticker print page is light, on screen and on paper;
 * - every other page – the visitor pages, the start page, the legal pages, the visitor not-found page – is dark.
 * A pure rule of the address, so the proxy, the root layout and the browser all decide alike.
 */
export type Design = "dark" | "light";

/** The device's choice: a cookie of the browser, never of the account – the workshop PC and a phone can differ. */
export const DESIGN_COOKIE = "design";

/** The request header the proxy passes the page's path in – the root layout cannot know it otherwise. */
export const PAGE_PATH_HEADER = "x-la-guardia-page-path";

/** The device's choice from its cookie – none for anything but a design. */
export function deviceDesign(cookie: string | undefined): Design | undefined {
  return cookie === "dark" || cookie === "light" ? cookie : undefined;
}

export function designOf(path: string, device: Design | undefined): Design {
  if (isUnder(path, "/team/machines/stickers/print")) return "light";
  if (isUnder(path, "/team") || isUnder(path, "/login")) return device ?? "dark";
  return "dark";
}

function isUnder(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}
