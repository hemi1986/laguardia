import Link from "next/link";
import type { ReactNode } from "react";
import type { Latest } from "@/platform/command";

/**
 * A history on the machine record (G24, architecture review 2026-10-30): its latest entries, then the link to its page
 * of its own – „Alle … (n)“, n counting every entry. The link is shown when the page has more than the record shows;
 * `linkWhenAny` shows it as soon as there is anything, for a history whose page shows more of each entry than the
 * record does (the repair history: open defects, work log entries, photos – ST-033). A history without any entry shows
 * `emptyText`.
 */
export function LatestWithAll<Entry>({
  history,
  emptyText,
  allAt,
  allText,
  linkWhenAny = false,
  children,
}: {
  history: Latest<Entry>;
  emptyText?: string;
  allAt: string;
  allText: (total: number) => string;
  linkWhenAny?: boolean;
  children: (latest: Entry[]) => ReactNode;
}) {
  if (history.total === 0 && emptyText) return <p className="text-sm">{emptyText}</p>;
  const linked = linkWhenAny ? history.total > 0 : history.total > history.latest.length;
  return (
    <>
      {history.latest.length > 0 && children(history.latest)}
      {linked && (
        <Link href={allAt} className="self-start text-sm underline underline-offset-4">
          {allText(history.total)}
        </Link>
      )}
    </>
  );
}
