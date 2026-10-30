import { teamMessages } from "@/platform/messages";
import { MachineHistoryFrame, YearSections } from "../machine-history";
import { StatusChangeList } from "../status-changes";
import type { StatusHistoryData } from "./status-history-data";

const { machineRecord } = teamMessages;

/**
 * Every entry of one machine's status history (ST-093), the newest first, under a heading per year with its count –
 * all on one page (G24). It is never empty: its first entry is the registration.
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
    <MachineHistoryFrame museumNumber={museumNumber} machineModelTitle={data.machineModelTitle}>
      <YearSections years={data.years}>{(changes) => <StatusChangeList changes={changes} />}</YearSections>
    </MachineHistoryFrame>
  );
}
