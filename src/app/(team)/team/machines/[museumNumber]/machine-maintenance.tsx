import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { teamMessages } from "@/platform/messages";
import { formatCalendarDate } from "@/platform/time";
import { recordMaintenanceAddress } from "../../maintenance/erfassen/record-maintenance-address";
import type { MachineMaintenance, ShownMaintenanceRecord } from "./machine-record-data";

const { machineMaintenance: texts, dueMaintenance, recordMaintenance, machineRecord } = teamMessages;

/**
 * Section 5 of the machine record, „Wartung“ (ST-047, G18): first the due maintenance tasks – an overdue one marked in
 * words (G6a) – with „Wartung erfassen“ where Maintenance would accept the viewer (G11); then the latest maintenance
 * records, the newest first, and the link to all of them. Texts are plain text: React escapes them.
 */
export function MachineMaintenanceSection({
  maintenance,
  museumNumber,
}: {
  maintenance: MachineMaintenance;
  museumNumber: string;
}) {
  const machine = `/team/machines/${encodeURIComponent(museumNumber)}`;
  return (
    <section>
      <Card>
        <CardHeader>
          <CardTitle>{texts.title}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 [overflow-wrap:anywhere]">
          {maintenance.notOnDisplay ? (
            <p className="text-sm">{texts.notOnDisplay}</p>
          ) : maintenance.due.length === 0 ? (
            <p className="text-sm">{texts.nothingDue}</p>
          ) : (
            <ol className="flex flex-col gap-4">
              {maintenance.due.map((task) => (
                <li key={task.maintenanceTaskId}>
                  <article className="flex flex-col gap-1 text-sm">
                    <p className="font-medium">{task.name}</p>
                    <p className="text-muted-foreground">{texts.dueSince(formatCalendarDate(task.dueSince))}</p>
                    {task.overdue && <p className="font-medium">{dueMaintenance.overdue}</p>}
                    {task.recordOffered && (
                      <Link
                        href={recordMaintenanceAddress({
                          maintenanceTaskId: task.maintenanceTaskId,
                          museumNumber,
                          back: "machine",
                        })}
                        className={buttonVariants({ variant: "outline", size: "sm", className: "mt-1 self-start" })}
                      >
                        {recordMaintenance.record}
                      </Link>
                    )}
                  </article>
                </li>
              ))}
            </ol>
          )}
          <h3 className="text-sm font-medium">{texts.records}</h3>
          {maintenance.recordCount === 0 ? (
            <p className="text-sm">{texts.nothingRecorded}</p>
          ) : (
            <>
              <MaintenanceRecordList records={maintenance.latestRecords} />
              {maintenance.recordCount > maintenance.latestRecords.length && (
                <Link href={`${machine}/wartungseintraege`} className="self-start text-sm underline underline-offset-4">
                  {texts.allRecords(maintenance.recordCount)}
                </Link>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

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
              {texts.whoAndWhen(record.recordedBy ?? machineRecord.unknownTeamMember, formatCalendarDate(record.date))}
            </p>
            {record.note && <p className="whitespace-pre-line">{record.note}</p>}
          </article>
        </li>
      ))}
    </ol>
  );
}
