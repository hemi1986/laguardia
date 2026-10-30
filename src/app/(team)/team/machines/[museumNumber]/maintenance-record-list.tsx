import { teamMessages } from "@/platform/messages";
import { formatCalendarDate } from "@/platform/time";
import type { ShownMaintenanceRecord } from "./machine-record-data";

const { machineMaintenance: texts, recordMaintenance } = teamMessages;

/** Maintenance records in the given order: the maintenance task, the outcome, who and when, the note. */
export function MaintenanceRecordList({ records }: { records: readonly ShownMaintenanceRecord[] }) {
  return (
    <ol className="flex flex-col gap-4 [overflow-wrap:anywhere]">
      {records.map((record) => (
        <li key={record.id}>
          <article className="flex flex-col gap-1 text-sm">
            <p className="font-medium">{record.maintenanceTaskName}</p>
            <p>{recordMaintenance.outcomes[record.outcome]}</p>
            <p className="text-muted-foreground">
              {texts.whoAndWhen(record.recordedBy, formatCalendarDate(record.date))}
            </p>
            {record.note && <p className="whitespace-pre-line">{record.note}</p>}
          </article>
        </li>
      ))}
    </ol>
  );
}
