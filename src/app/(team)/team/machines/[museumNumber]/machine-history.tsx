import type { ReactNode } from "react";
import { BackLink } from "@/components/ui/back-link";
import { Section } from "@/components/ui/section";
import { teamMessages } from "@/platform/messages";
import { teamMachinePage } from "@/app/museum-number-address";
import type { HistoryYear } from "./history-by-year";

const { machineHistory: texts, machinePages } = teamMessages;

/**
 * A machine's history on a page of its own (G24, architecture review 2026-10-30): the machine model's title, the
 * history – or, when there is nothing, the text saying so – and „Zurück zum Gerät“. The status history, the maintenance
 * records and the repair history. Texts are plain text: React escapes them.
 */
export function MachineHistoryFrame({
  museumNumber,
  machineModelTitle,
  emptyText,
  children,
}: {
  museumNumber: string;
  machineModelTitle: string;
  /** Shown in place of the history when there is none – a history that always has an entry passes none. */
  emptyText?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6 [overflow-wrap:anywhere]">
      <p className="text-muted-foreground text-sm">{machineModelTitle}</p>
      {emptyText ? <p>{emptyText}</p> : children}
      <BackToMachine museumNumber={museumNumber} />
    </div>
  );
}

/** Every year of a history, the newest first, each under „2026 · 5 Einträge“ with its entries (G24). */
export function YearSections<Entry>({
  years,
  children,
}: {
  years: readonly HistoryYear<Entry>[];
  children: (entries: Entry[]) => ReactNode;
}) {
  return years.map(({ year, entries }) => (
    <Section key={year} title={texts.year(year, entries.length)}>
      {children(entries)}
    </Section>
  ));
}

/** „Zurück zum Gerät“ – from any page of a machine back to its machine record. */
export function BackToMachine({ museumNumber }: { museumNumber: string }) {
  return <BackLink href={teamMachinePage()(museumNumber)}>{machinePages.backToMachine}</BackLink>;
}
