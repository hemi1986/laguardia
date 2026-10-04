import Link from "next/link";
import { teamMessages } from "@/platform/messages";
import { formatDateTime } from "@/platform/time";
import type { OpenDefectsData } from "./open-defects-data";

const { defects: texts, recordDefect, terms } = teamMessages;

/**
 * The open defects list (RM-OpenDefects, ST-021): by priority – high first –, within a priority the oldest first. An
 * entry shows what tells it apart (G5) and leads to the defect's own page. Titles are plain text: React escapes them.
 */
export function OpenDefectsView({ data }: { data: OpenDefectsData }) {
  return (
    <ol className="flex flex-col gap-4 [overflow-wrap:anywhere]">
      {data.entries.map((entry) => (
        <li key={entry.id}>
          <article className="flex flex-col gap-1 text-sm">
            <Link href={`/team/defects/${entry.id}`} className="font-medium underline underline-offset-4">
              {entry.title}
            </Link>
            <p>
              {entry.museumNumber} · {entry.machineModelTitle}
            </p>
            <p className="text-muted-foreground">
              {texts.priority(recordDefect.priorities[entry.priority])}
              {entry.suitableForHelpers && ` · ${terms["Suitable for helpers"]}`}
            </p>
            <p className="text-muted-foreground">
              {formatDateTime(entry.openSince)} · {texts.openFor(entry.openHours)}
            </p>
          </article>
        </li>
      ))}
    </ol>
  );
}
