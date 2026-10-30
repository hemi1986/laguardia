import { calendarDate, type CalendarDate } from "@/platform/time";

/** One year of a machine's history on its page of its own (G24) – the year and its entries. */
export type HistoryYear<Entry> = { year: string; entries: Entry[] };

/**
 * A machine's history by year (G24, architecture review 2026-10-30): the Berlin calendar year of each entry – of its
 * instant, or of its calendar date (`YYYY-MM-DD`, already Berlin's) –, the newest year first; inside a year the entries
 * stay in the order they came, so each history keeps its own order. Shared by the status history, the maintenance
 * records and the repair history.
 */
export function byYear<Entry>(
  entries: readonly Entry[],
  when: (entry: Entry) => Date | CalendarDate,
): HistoryYear<Entry>[] {
  const years = new Map<string, Entry[]>();
  for (const entry of entries) {
    const at = when(entry);
    const year = (typeof at === "string" ? at : calendarDate(at)).slice(0, 4);
    years.set(year, [...(years.get(year) ?? []), entry]);
  }
  // The years are written alike, so their order as text is their order in time.
  return [...years].map(([year, inYear]) => ({ year, entries: inYear })).sort((a, b) => b.year.localeCompare(a.year));
}
