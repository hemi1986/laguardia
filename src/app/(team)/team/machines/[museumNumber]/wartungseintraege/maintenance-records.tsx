import { BackLink } from "@/components/ui/back-link";
import { Section } from "@/components/ui/section";
import { teamMessages } from "@/platform/messages";
import { MaintenanceRecordList } from "../machine-maintenance";
import type { AllMaintenanceRecordsData } from "./maintenance-records-data";

const { machineMaintenance: texts, machineRecord } = teamMessages;

/**
 * Every maintenance record of one machine (ST-047), the newest first, under a heading per year with its count – all on
 * one page (user, `/implement ST-047`). Texts are plain text: React escapes them.
 */
export function MaintenanceRecordsView({
  data,
  museumNumber,
}: {
  data: AllMaintenanceRecordsData | undefined;
  museumNumber: string;
}) {
  if (!data) return <p>{machineRecord.unknown(museumNumber)}</p>;
  return (
    <div className="flex flex-col gap-6 [overflow-wrap:anywhere]">
      <p className="text-muted-foreground text-sm">{data.machineModelTitle}</p>
      {data.years.length === 0 ? (
        <p>{texts.nothingRecorded}</p>
      ) : (
        data.years.map(({ year, records }) => (
          <Section key={year} title={texts.year(year, records.length)}>
            <MaintenanceRecordList records={records} />
          </Section>
        ))
      )}
      <BackLink href={`/team/machines/${encodeURIComponent(museumNumber)}`}>{texts.backToMachine}</BackLink>
    </div>
  );
}
