import Link from "next/link";
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
          <section key={year} className="flex flex-col gap-4">
            <h2 className="font-semibold">{texts.year(year, records.length)}</h2>
            <MaintenanceRecordList records={records} />
          </section>
        ))
      )}
      <Link
        href={`/team/machines/${encodeURIComponent(museumNumber)}`}
        className="self-start text-sm underline underline-offset-4"
      >
        {texts.backToMachine}
      </Link>
    </div>
  );
}
