import { machineOfMuseumNumber } from "@/modules/collection";
import type { Database } from "@/platform/command";
import { teamMachinePage } from "@/app/museum-number-address";
import { fileOverviewAddress, queryString, strictFileOverviewQueryOf, type FileOverviewQuery } from "../../file-overview-query";

/**
 * Where a person came to the file details from (G17, ST-114, ST-117) – a **closed set**, never a free return address: a
 * machine record (by museum number), the form „KI“ on „Einstellungen“, „Dateien“ with its filters and page, or none.
 * Anything else in the address is none, so the way back cannot become an open redirect. None leads to „Dateien“ too –
 * its first page, unfiltered.
 */
export type FileOrigin =
  | { kind: "machine"; museumNumber: string }
  | { kind: "settings" }
  | { kind: "files"; query: FileOverviewQuery }
  | { kind: "none" };

/** The place a page names when it links to the file details – the machine record, the form „KI“ or „Dateien“. */
export type PlaceOfPage = { machine: string } | "settings" | { files: FileOverviewQuery };

/** The query parameter that carries the origin. */
export const ORIGIN_PARAM = "from";

const MACHINE_PREFIX = "machine:";
const FILES = "files";
const FILES_PREFIX = "files:";

/** „Dateien“ with its filters and page: `files` or `files:<the overview's own parameters>`. */
function filesValue(query: FileOverviewQuery): string {
  const rest = queryString(query);
  return rest ? FILES_PREFIX + rest : FILES;
}

/** The address's value for a place – or the value an address carried, handed on as it was (the page checks it again). */
export function originValue(origin: FileOrigin | PlaceOfPage | string | undefined): string | undefined {
  if (typeof origin === "string") return origin;
  if (!origin) return undefined;
  if ("machine" in origin) return MACHINE_PREFIX + origin.machine;
  if ("files" in origin) return filesValue(origin.files);
  if (origin.kind === "settings") return "settings";
  if (origin.kind === "machine") return MACHINE_PREFIX + origin.museumNumber;
  if (origin.kind === "files") return filesValue(origin.query);
  return undefined;
}

/**
 * A file's details, reached from this place (G17) – the one place that builds the address, for the links of the machine
 * record and the form „KI“ and for where „Erneut versuchen“ lands (`retried`, G3). The origin may be „Dateien“ (ST-117).
 */
export function fileDetailsAddress(
  fileId: string,
  origin?: FileOrigin | PlaceOfPage | string,
  {
    retried = false,
    attached = false,
    detached,
    detachFailed,
    saved = false,
  }: { retried?: boolean; attached?: boolean; detached?: string; detachFailed?: string; saved?: boolean } = {},
): string {
  const search = new URLSearchParams();
  const value = originValue(origin);
  if (value) search.set(ORIGIN_PARAM, value);
  if (retried) search.set("retried", "1");
  if (attached) search.set("attached", "1");
  if (detached) search.set("detached", detached);
  if (detachFailed) search.set("detachFailed", detachFailed);
  if (saved) search.set("saved", "1");
  return `/team/dateien/${fileId}/details${search.size > 0 ? `?${search}` : ""}`;
}

/** Where attaching a file lands (ST-115, G3, G33): its details, which say what it is attached to now. */
export function attachLanding(fileId: string, origin?: FileOrigin | PlaceOfPage | string): string {
  return fileDetailsAddress(fileId, origin, { attached: true });
}

/** Where correcting a file lands (ST-116, G3, G33): its details, which confirm the save – also when nothing changed. */
export function changeLanding(fileId: string, origin?: FileOrigin | PlaceOfPage | string): string {
  return fileDetailsAddress(fileId, origin, { saved: true });
}

/** The form „Datei bearbeiten“ (ST-116), reached from the head of the file details, with the origin kept (G17). */
export function changeFileDetailsAddress(fileId: string, origin?: FileOrigin | PlaceOfPage | string): string {
  const search = new URLSearchParams();
  const value = originValue(origin);
  if (value) search.set(ORIGIN_PARAM, value);
  return `/team/dateien/${fileId}/details/bearbeiten${search.size > 0 ? `?${search}` : ""}`;
}

/** The form „Anhängen“ (ST-115), reached from the file details, with the origin kept (G17). */
export function attachToFileAddress(fileId: string, origin?: FileOrigin | PlaceOfPage | string): string {
  const search = new URLSearchParams();
  const value = originValue(origin);
  if (value) search.set(ORIGIN_PARAM, value);
  return `/team/dateien/${fileId}/details/anhaengen${search.size > 0 ? `?${search}` : ""}`;
}

/** Where detaching a file lands (ST-115, G3): its details, with the target it was detached from. */
export function detachLanding(
  fileId: string,
  origin: FileOrigin | PlaceOfPage | string | undefined,
  target: string,
): string {
  return fileDetailsAddress(fileId, origin, { detached: target });
}

/** Where a detach that met a removed file lands (ST-115): the details' removed state, which shows the rejection. */
export function detachFailureLanding(fileId: string, origin: FileOrigin | PlaceOfPage | string | undefined): string {
  return fileDetailsAddress(fileId, origin, { detachFailed: "file-removed" });
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
 * the file. Without a known origin the first page of „Dateien“ (ST-117).
 */
export function removalLanding(origin: FileOrigin, fileId: string): string {
  const query = new URLSearchParams({ fileRemoved: fileId });
  switch (origin.kind) {
    case "machine":
      return `${teamMachinePage()(origin.museumNumber)}?${query}`;
    case "settings":
      // The confirmation sits in the section „KI“, the page's last section – the anchor makes it visible (G3).
      return `/team/museum-settings?${query}#ki`;
    case "files":
      return fileOverviewAddress(origin.query, { fileRemoved: fileId });
    case "none":
      return fileOverviewAddress({}, { fileRemoved: fileId });
  }
}

/** Where the way back leads, from the checked origin – an address of this site built here, never taken from the request. */
export function wayBack(origin: FileOrigin): { href: string; kind: FileOrigin["kind"] } {
  switch (origin.kind) {
    case "machine":
      return { href: teamMachinePage()(origin.museumNumber), kind: "machine" };
    case "settings":
      return { href: "/team/museum-settings", kind: "settings" };
    case "files":
      return { href: fileOverviewAddress(origin.query), kind: "files" };
    case "none":
      return { href: fileOverviewAddress(), kind: "none" };
  }
}

/**
 * The origin the address names, checked: a machine only when its museum number is one of a registered machine (a
 * reserved one counts as its machine's current museum number), the settings only for a technician – a helper does not
 * reach them (G11, G19), „Dateien“ only with parameters of its own and values it knows.
 */
export async function originOf(
  db: Database,
  value: string | string[] | undefined,
  viewer: { role: "helper" | "technician" },
): Promise<FileOrigin> {
  if (value === "settings") return viewer.role === "technician" ? { kind: "settings" } : { kind: "none" };
  if (value === FILES) return { kind: "files", query: {} };
  if (typeof value === "string" && value.startsWith(FILES_PREFIX)) {
    const query = strictFileOverviewQueryOf(new URLSearchParams(value.slice(FILES_PREFIX.length)));
    return query ? { kind: "files", query } : { kind: "none" };
  }
  if (typeof value === "string" && value.startsWith(MACHINE_PREFIX)) {
    const machine = await machineOfMuseumNumber(db, value.slice(MACHINE_PREFIX.length));
    if (machine) return { kind: "machine", museumNumber: machine.museumNumber };
  }
  return { kind: "none" };
}
