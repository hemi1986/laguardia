import { BackLink } from "@/components/ui/back-link";
import { Section } from "@/components/ui/section";
import { teamMessages } from "@/platform/messages";
import { StatusChangeList } from "../machine-record";
import type { StatusHistoryData } from "./status-history-data";

const { statusHistory: texts, machineRecord } = teamMessages;

/**
 * Every entry of one machine's status history (ST-093), the newest first, under a heading per year with its count –
 * all on one page, like the maintenance records (G24). Texts are plain text: React escapes them.
 */
export function StatusHistoryView({
  data,
  museumNumber,
}: {
  data: StatusHistoryData | undefined;
  museumNumber: string;
}) {
  if (!data) return <p>{machineRecord.unknown(museumNumber)}</p>;
  return (
    <div className="flex flex-col gap-6 [overflow-wrap:anywhere]">
      <p className="text-muted-foreground text-sm">{data.machineModelTitle}</p>
      {data.years.map(({ year, changes }) => (
        <Section key={year} title={texts.year(year, changes.length)}>
          <StatusChangeList changes={changes} />
        </Section>
      ))}
      <BackLink href={`/team/machines/${encodeURIComponent(museumNumber)}`}>{texts.backToMachine}</BackLink>
    </div>
  );
}
