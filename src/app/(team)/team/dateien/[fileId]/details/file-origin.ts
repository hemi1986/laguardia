import { machineOfMuseumNumber } from "@/modules/collection";
import type { Database } from "@/platform/command";
import { teamMachinePage } from "@/app/museum-number-address";

/**
 * Where a person came to the file details from (G17, ST-114) – a **closed set**, never a free return address: a machine
 * record (by museum number), the form „KI“ on „Einstellungen“, or none. ST-117 adds „Dateien“. Anything else in the
 * address is none, so the way back cannot become an open redirect.
 */
export type FileOrigin = { kind: "machine"; museumNumber: string } | { kind: "settings" } | { kind: "none" };

/** What a page that links to the file details names as the place it is on. */
export type OriginOfLink = { machine: string } | "settings";

/** The query parameter that carries the origin. */
export const ORIGIN_PARAM = "from";

const MACHINE_PREFIX = "machine:";

/** The address's value for an origin – none for no origin. */
export function originValue(origin: FileOrigin | OriginOfLink | undefined): string | undefined {
  if (origin === "settings") return "settings";
  if (origin && typeof origin === "object" && "machine" in origin) return `${MACHINE_PREFIX}${origin.machine}`;
  if (origin && typeof origin === "object" && "kind" in origin) {
    if (origin.kind === "settings") return "settings";
    if (origin.kind === "machine") return `${MACHINE_PREFIX}${origin.museumNumber}`;
  }
  return undefined;
}

/** A file's details, reached from this place (G17) – the one way a page builds the address. */
export function fileDetailsAddress(fileId: string, origin?: FileOrigin | OriginOfLink, extra?: Record<string, string>) {
  const search = new URLSearchParams();
  const value = originValue(origin);
  if (value) search.set(ORIGIN_PARAM, value);
  for (const [key, each] of Object.entries(extra ?? {})) search.set(key, each);
  return `/team/dateien/${fileId}/details${search.size > 0 ? `?${search}` : ""}`;
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

/** Where the way back leads, from the checked origin – an address of this site built here, never taken from the request. */
export function wayBack(origin: FileOrigin): { href: string; kind: FileOrigin["kind"]; museumNumber?: string } {
  switch (origin.kind) {
    case "machine":
      return { href: teamMachinePage()(origin.museumNumber), kind: "machine", museumNumber: origin.museumNumber };
    case "settings":
      return { href: "/team/museum-settings", kind: "settings" };
    case "none":
      return { href: "/team/machines", kind: "none" };
  }
}
