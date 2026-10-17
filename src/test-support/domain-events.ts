import { readFileSync } from "node:fs";

/**
 * The events of `docs/domain/events.yaml` with the aggregates their journal entries may name (ST-079 Q15): the
 * event's own aggregate, and the aggregate of each command that produces it – a journal entry is written by the command
 * on the aggregate it changed (EVT-DefectRecorded: CMD-RecordDefect on the problem report creates the defect).
 */
export function domainEventAggregates(): Map<string, Set<string>> {
  const text = readFileSync("docs/domain/events.yaml", "utf8");
  const aggregates = new Map<string, Set<string>>();
  const allow = (event: string, aggregate: string) =>
    aggregates.set(event, new Set([...(aggregates.get(event) ?? []), aggregate]));
  for (const [, id, aggregate, rest] of text.matchAll(
    /^ {2}- id: ((?:EVT|CMD)-\w+)\n {4}aggregate: (AGG-\w+)\n((?: {4}.*\n)*)/gm,
  )) {
    if (id!.startsWith("EVT-")) allow(id!, aggregate!);
    const produces = /^ {4}produces: \[([^\]]*)\]/m.exec(rest!)?.[1];
    for (const event of produces?.split(",").map((name) => name.trim()) ?? []) allow(event, aggregate!);
  }
  return aggregates;
}
