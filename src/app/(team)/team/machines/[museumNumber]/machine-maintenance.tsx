import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
import { teamMessages } from "@/platform/messages";
import { formatCalendarDate } from "@/platform/time";
import { recordMaintenanceAddress } from "../../maintenance/erfassen/record-maintenance-address";
import { MaintenanceRecordList } from "./maintenance-record-list";
import type { ShownMachineMaintenance } from "./machine-record-data";

const { machineMaintenance: texts, dueMaintenance, recordMaintenance } = teamMessages;

/**
 * Section 5 of the machine record, „Wartung“ (ST-047, G18): first the due maintenance tasks – an overdue one marked in
 * words (G6a) – with „Wartung erfassen“ where Maintenance would accept the viewer (G11); then the latest maintenance
 * records, the newest first, and the link to all of them; at its end how many maintenance tasks apply to the machine and,
 * for a technician, „Wartungsaufgaben ändern“ (ST-096, G29, G11). Texts are plain text: React escapes them.
 */
export function MachineMaintenanceSection({
  maintenance,
  museumNumber,
}: {
  maintenance: ShownMachineMaintenance;
  museumNumber: string;
}) {
  const machine = `/team/machines/${encodeURIComponent(museumNumber)}`;
  return (
    <Section title={texts.title}>
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
      <p className="text-sm">{texts.tasksApply(maintenance.taskCount)}</p>
      {maintenance.changeOffered && (
        <Link
          href={`${machine}/wartungsaufgaben-aendern`}
          className={buttonVariants({ variant: "outline", size: "sm", className: "self-start" })}
        >
          {texts.changeTasks}
        </Link>
      )}
    </Section>
  );
}
