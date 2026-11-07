import { isId, lastCommandBy, type Database, type JournalEntry } from "@/platform/command";

/**
 * A confirmation after a redirect (G3, G33), the one place that reads the address for it (architecture review
 * 2026-11-06). The address only says *what* to look for; every parameter follows exactly one of two rules, named by its
 * row in `docs/engineering/conventions.md` (*A confirmation after an action*):
 *
 * - **journal** – shown only when the team member looking at the page ran the latest command on what the address names
 *   (`viewersCommandOn`), and the owning module's `…In` says that command was this action. Never from the address alone.
 * - **state** – the address names what happened and the page says what is true *now* (a change that changes nothing
 *   records no event, so there is nothing to ask the journal): shown only for what exists, and the sentence states the
 *   resulting state, never a claim about who did it.
 */

/** A page's query as Next.js hands it over – what the address asks a page to confirm. */
export type AddressQuery = { [name: string]: string | string[] | undefined };

/** One value of the query – none when the address gives it twice. */
export const oneOf = (value: string | string[] | undefined) => (typeof value === "string" ? value : undefined);

/**
 * The events of the latest command on the aggregate an address names – only when `id` is an ID (an address is untrusted
 * input) and the viewer ran that command. The journal rule's first half; the owning module's `…In` is the second.
 */
export async function viewersCommandOn(
  db: Database,
  viewer: string,
  id: string | undefined,
): Promise<JournalEntry[] | undefined> {
  if (id === undefined || !isId(id)) return undefined;
  return lastCommandBy(db, { aggregateId: id }, viewer);
}
