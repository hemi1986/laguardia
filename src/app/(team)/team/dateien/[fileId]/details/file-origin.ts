import { machineOfMuseumNumber } from "@/modules/collection";
import type { Database } from "@/platform/command";
import { teamMachinePage } from "@/app/museum-number-address";

/**
 * Where a person came to the file details from (G17, ST-114) – a **closed set**, never a free return address: a machine
 * record (by museum number), the form „KI“ on „Einstellungen“, or none. ST-117 adds „Dateien“. Anything else in the
 * address is none, so the way back cannot become an open redirect.
 */
export type FileOrigin = { kind: "machine"; museumNumber: string } | { kind: "settings" } | { kind: "none" };

/** The place a page names when it links to the file details – the machine record or the form „KI“. */
export type PlaceOfPage = { machine: string } | "settings";

/** The query parameter that carries the origin. */
export const ORIGIN_PARAM = "from";

const MACHINE_PREFIX = "machine:";

/** The address's value for a place – or the value an address carried, handed on as it was (the page checks it again). */
export function originValue(origin: FileOrigin | PlaceOfPage | string | undefined): string | undefined {
  if (typeof origin === "string") return origin;
  if (!origin) return undefined;
  if ("machine" in origin) return MACHINE_PREFIX + origin.machine;
  if (origin.kind === "settings") return "settings";
  if (origin.kind === "machine") return MACHINE_PREFIX + origin.museumNumber;
  return undefined;
}

/**
 * A file's details, reached from this place (G17) – the one place that builds the address, for the links of the machine
 * record and the form „KI“ and for where „Erneut versuchen“ lands (`retried`, G3). ST-117 adds „Dateien“ here.
 */
export function fileDetailsAddress(
  fileId: string,
  origin?: FileOrigin | PlaceOfPage | string,
  { retried = false }: { retried?: boolean } = {},
): string {
  const search = new URLSearchParams();
  const value = originValue(origin);
  if (value) search.set(ORIGIN_PARAM, value);
  if (retried) search.set("retried", "1");
  return `/team/dateien/${fileId}/details${search.size > 0 ? `?${search}` : ""}`;
}

/** The question before removing a file (ST-121), with the origin kept – „Zurück“ and the removal land there. */
export function removeFileAddress(fileId: string, origin?: FileOrigin | PlaceOfPage | string): string {
  const search = new URLSearchParams();
  const value = originValue(origin);
  if (value) search.set(ORIGIN_PARAM, value);
  return `/team/dateien/${fileId}/details/entfernen${search.size > 0 ? `?${search}` : ""}`;
}

/**
 * Where the removal lands (G3, ST-121): the place the file details' way back leads to, with the confirmation that names
 * the file. Without a known origin the machine overview – until ST-117 makes that „Dateien“.
 */
export function removalLanding(origin: FileOrigin, fileId: string): string {
  const query = new URLSearchParams({ fileRemoved: fileId });
  switch (origin.kind) {
    case "machine":
      return `${teamMachinePage()(origin.museumNumber)}?${query}`;
    case "settings":
      // The confirmation sits in the section „KI“, the page's last section – the anchor makes it visible (G3).
      return `/team/museum-settings?${query}#ki`;
    case "none":
      return `/team/machines?${query}`;
  }
}

/** Where the way back leads, from the checked origin – an address of this site built here, never taken from the request. */
export function wayBack(origin: FileOrigin): { href: string; kind: FileOrigin["kind"] } {
  switch (origin.kind) {
    case "machine":
      return { href: teamMachinePage()(origin.museumNumber), kind: "machine" };
    case "settings":
      return { href: "/team/museum-settings", kind: "settings" };
    case "none":
      return { href: "/team/machines", kind: "none" };
  }
}

/**
 * The origin the address names, checked: a machine only when its museum number is one of a registered machine (a
 * reserved one counts as its machine's current museum number), the settings only for a technician – a helper does not
 * reach them (G11, G19).
 */
export async function originOf(
  db: Database,
  value: string | string[] | undefined,
  viewer: { role: "helper" | "technician" },
): Promise<FileOrigin> {
  if (value === "settings") return viewer.role === "technician" ? { kind: "settings" } : { kind: "none" };
  if (typeof value === "string" && value.startsWith(MACHINE_PREFIX)) {
    const machine = await machineOfMuseumNumber(db, value.slice(MACHINE_PREFIX.length));
    if (machine) return { kind: "machine", museumNumber: machine.museumNumber };
  }
  return { kind: "none" };
}
