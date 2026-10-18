import { and, asc, eq, gte, inArray, isNull, ne, or, type SQL } from "drizzle-orm";
import { eventJournal } from "../schema";
import { journalEntryOf, type Database, type JournalEntry, type JournalEvent, type TeamMemberId } from "./index";

/**
 * The event catalogue of a module (architecture review 2026-09-27 Q4, 2026-10-17; ST-079): per event type its
 * aggregate and its journal projection – where its aggregate and machine come from, and the only fields that reach the
 * journal: references and facts from fixed lists, never text a person typed (ST-003). Commands hand their domain events
 * to the catalogue, and readers get the journal back typed by the same projection – both directions in one place.
 */

/** A value the journal may hold for an event: a reference or a fact from a fixed list. */
export type JournalValue = string | number | boolean | null;

type Projected = {
  aggregateId: string;
  /** The machine the event concerns – null for an aggregate of no machine (a machine model, the maintenance plan). */
  machineId: string | null;
  data: { readonly [field: string]: JournalValue };
};

type Entry<Event> = { aggregate: `AGG-${string}`; project: (event: Event) => Projected };

// The event parameter of each projection is the module's own domain event type – `never` lets every entry name its own.
type Entries = { readonly [type: `EVT-${string}`]: Entry<never> };

export type EventCatalogue<E extends Entries> = {
  readonly entries: E;
  /** The journal entry of a domain event – the `journal` of `aggregateCommand`. */
  journal: (event: { type: keyof E & string }) => JournalEvent;
};

export function eventCatalogue<const E extends Entries>(entries: E): EventCatalogue<E> {
  return {
    entries,
    journal(event) {
      const entry = entries[event.type] as unknown as Entry<typeof event> | undefined;
      if (!entry) throw new Error(`${event.type} is not in the event catalogue`);
      const { aggregateId, machineId, data } = entry.project(event);
      return {
        type: event.type as `EVT-${string}`,
        aggregate: { type: entry.aggregate, id: aggregateId },
        machineId,
        data: { ...data },
      };
    },
  };
}

type DataOf<X> = X extends { project: (event: never) => { data: infer Data } } ? Data : never;

/** A journal entry of one of the catalogue's event types, its data typed by that type's projection. */
export type CatalogueEntry<E extends Entries, Type extends keyof E = keyof E> = {
  [T in Type]: Omit<JournalEntry, "type" | "data"> & {
    type: T;
    data: Partial<DataOf<E[T]>>;
  };
}[Type];

/**
 * Journal entries of the catalogue's event types, oldest first – what a dashboard asks (ST-086, ST-058, ST-050): of
 * these types, on these aggregates or this machine, since a moment, not by this team member. The journal feeds pages
 * and confirmations, never state (ADR 0002). Data are typed but partial: an entry written before a field joined the
 * projection lacks it.
 */
export async function readJournal<E extends Entries, const Type extends keyof E & string = keyof E & string>(
  db: Database,
  catalogue: EventCatalogue<E>,
  filter: {
    types?: readonly Type[];
    aggregateIds?: readonly string[];
    machineId?: string;
    since?: Date;
    notBy?: TeamMemberId;
  } = {},
): Promise<CatalogueEntry<E, Type>[]> {
  const types = filter.types ?? (Object.keys(catalogue.entries) as Type[]);
  if (types.length === 0 || filter.aggregateIds?.length === 0) return [];
  const conditions: (SQL | undefined)[] = [
    inArray(eventJournal.type, [...types]),
    filter.aggregateIds && inArray(eventJournal.aggregateId, [...filter.aggregateIds]),
    filter.machineId !== undefined ? eq(eventJournal.machineId, filter.machineId) : undefined,
    filter.since && gte(eventJournal.occurredAt, filter.since),
    filter.notBy !== undefined
      ? or(isNull(eventJournal.actorTeamMemberId), ne(eventJournal.actorTeamMemberId, filter.notBy))
      : undefined,
  ];
  const rows = await db
    .select()
    .from(eventJournal)
    .where(and(...conditions))
    .orderBy(asc(eventJournal.position));
  return rows.map((row) => journalEntryOf(row) as CatalogueEntry<E, Type>);
}

/**
 * The entries of one command (`lastCommandBy`) that are of the catalogue's event types, typed like `readJournal`'s – so
 * a module answers questions about a command it took part in without anyone matching its event types by string
 * (architecture review 2026-10-18).
 */
export function entriesOf<E extends Entries>(
  catalogue: EventCatalogue<E>,
  entries: readonly JournalEntry[],
): CatalogueEntry<E, keyof E & string>[] {
  return entries.filter((entry) => entry.type in catalogue.entries) as CatalogueEntry<E, keyof E & string>[];
}
