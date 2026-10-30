import { teamMessages } from "@/platform/messages";
import { MachineHistoryFrame, YearSections } from "../machine-history";
import { MaintenanceRecordList } from "../maintenance-record-list";
import type { AllMaintenanceRecordsData } from "./maintenance-records-data";

const { machineMaintenance: texts, machineRecord } = teamMessages;

/**
 * Every maintenance record of one machine (ST-047), the newest first, under a heading per year with its count – all on
 * one page (user, `/implement ST-047`; G24).
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
    <MachineHistoryFrame
      museumNumber={museumNumber}
      machineModelTitle={data.machineModelTitle}
      emptyText={data.years.length === 0 ? texts.nothingRecorded : undefined}
    >
      <YearSections years={data.years}>{(records) => <MaintenanceRecordList records={records} />}</YearSections>
    </MachineHistoryFrame>
  );
}
