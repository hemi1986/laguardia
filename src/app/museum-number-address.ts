import { redirect } from "next/navigation";
import { machineOfMuseumNumber } from "@/modules/collection";
import type { Database } from "@/platform/command";
import { database } from "@/platform/database";

/** A page of a machine, by the museum number in its address – where it is, for any museum number. */
export type MachinePage = (museumNumber: string) => string;

/** The machine record (no `sub`) or one of its pages, e.g. `teamMachinePage("standort")`. */
export function teamMachinePage(sub?: string): MachinePage {
  return (museumNumber) => `/team/machines/${encodeURIComponent(museumNumber)}${sub ? `/${sub}` : ""}`;
}

/** The visitor machine page at the QR address (no `sub`) or one of its pages, e.g. `visitorMachinePage("melden")`. */
export function visitorMachinePage(sub?: string): MachinePage {
  return (museumNumber) => `/m/${encodeURIComponent(museumNumber)}${sub ? `/${sub}` : ""}`;
}

type Query = Record<string, string | readonly string[] | undefined>;

/**
 * The museum number in the address of a machine's page (CONTEXT.md, ST-035): a reserved museum number still leads to
 * its machine – every page of a machine redirects from it to the same page under the current museum number, its query
 * kept, so an old QR sticker and an old link keep working. Returns the museum number otherwise – a current or an
 * unknown one; the page says what it says about an unknown machine. Call it once per page, after its access check.
 */
export async function museumNumberOfPage(
  { params, searchParams }: { params: Promise<{ museumNumber: string }>; searchParams?: Promise<Query> },
  page: MachinePage,
): Promise<string> {
  // Next.js answers 400 for a malformed percent-encoding before a page is reached.
  const museumNumber = decodeURIComponent((await params).museumNumber);
  const current = await pageUnderCurrentMuseumNumber(database(), museumNumber, page, (await searchParams) ?? {});
  if (current) redirect(current);
  return museumNumber;
}

/** Where the page leads when the museum number is reserved – undefined for a current or unknown one. */
export async function pageUnderCurrentMuseumNumber(
  db: Database,
  museumNumber: string,
  page: MachinePage,
  query: Query,
): Promise<string | undefined> {
  const machine = await machineOfMuseumNumber(db, museumNumber);
  if (!machine || machine.museumNumber === museumNumber) return undefined;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    for (const each of typeof value === "string" ? [value] : (value ?? [])) search.append(key, each);
  }
  return `${page(machine.museumNumber)}${search.size > 0 ? `?${search}` : ""}`;
}
