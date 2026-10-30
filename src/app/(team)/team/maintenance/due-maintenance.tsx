import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FilterForm } from "@/components/ui/filter-form";
import { Confirmation, Rejection } from "@/components/ui/message";
import { formatCalendarDate } from "@/platform/time";
import { commandErrorText, teamMessages } from "@/platform/messages";
import { MachineLink } from "../machine-link";
import { recordMaintenanceAddress } from "./erfassen/record-maintenance-address";
import { dueMaintenanceAddress, type Confirmed, type DueMaintenanceData } from "./due-maintenance-data";

const { dueMaintenance: texts, recordForSeveral: severalTexts, terms } = teamMessages;

/**
 * The due maintenance list (RM-DueMaintenance, ST-043, G4a): first every due maintenance task with on how many machines
 * it is due and how many of those are overdue, in words; its machines – sorted by location – only after choosing it.
 * Overdue is said in words, not only by a colour (G6a). Texts are plain text: React escapes them.
 */
export function DueMaintenanceView({ data }: { data: DueMaintenanceData }) {
  const { filter, chosen } = data;
  const confirmation = data.confirmed && <RecordedConfirmation confirmed={data.confirmed} />;
  if (chosen) {
    return (
      <section className="flex flex-col gap-4 [overflow-wrap:anywhere]">
        {confirmation}
        {/* The way back sits above the machines – a task can be due on 60 of them (G17). */}
        <Link
          href={dueMaintenanceAddress({ ...filter, maintenanceTaskId: undefined })}
          className="self-start text-sm underline underline-offset-4"
        >
          {texts.allDue}
        </Link>
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">{chosen.name}</h2>
          <p className="text-sm whitespace-pre-line">{chosen.instruction}</p>
          {chosen.suitableForHelpers && (
            <p className="text-muted-foreground text-sm">{terms["Suitable for helpers"]}</p>
          )}
          <p className="text-sm">{texts.counts(chosen.machines.length, chosen.overdueCount)}</p>
        </div>
        {/* One action for a whole hall (ST-045) – offered to whoever may record the task (G11). */}
        {chosen.machines.some((machine) => machine.recordOffered) && (
          <Link
            href={`/team/maintenance/mehrere?task=${encodeURIComponent(chosen.id)}`}
            className={buttonVariants({ variant: "outline", className: "self-start" })}
          >
            {severalTexts.start}
          </Link>
        )}
        <ol className="flex flex-col gap-4">
          {chosen.machines.map((machine) => (
            <li key={machine.machineId}>
              <article className="flex flex-col gap-1 text-sm">
                <MachineLink museumNumber={machine.museumNumber} machineModelTitle={machine.machineModelTitle} />
                <p>{machine.location}</p>
                <p className="text-muted-foreground">
                  {machine.lastDone
                    ? texts.lastDoneAndDue(formatCalendarDate(machine.lastDone), formatCalendarDate(machine.dueSince))
                    : texts.dueSinceNeverDone(formatCalendarDate(machine.dueSince))}
                </p>
                {machine.overdue && <p className="font-medium">{texts.overdue}</p>}
                {/* The one action people come to the list for (G5), offered only where it will be accepted (G11). */}
                {machine.recordOffered && (
                  <Link
                    href={recordMaintenanceAddress({
                      maintenanceTaskId: chosen.id,
                      museumNumber: machine.museumNumber,
                      back: "list",
                    })}
                    className={buttonVariants({ variant: "outline", size: "sm", className: "mt-1 self-start" })}
                  >
                    {teamMessages.recordMaintenance.record}
                  </Link>
                )}
              </article>
            </li>
          ))}
        </ol>
      </section>
    );
  }
  return (
    <>
      {confirmation}
      <FilterForm action="/team/maintenance" apply={teamMessages.filters.apply}>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox name="helpers" value="1" defaultChecked={filter.suitableForHelpers ?? false} />
          {texts.onlySuitableForHelpers}
        </label>
      </FilterForm>
      {data.tasks.length === 0 ? (
        <p>{filter.suitableForHelpers ? texts.nothingDueForHelpers : texts.nothingDue}</p>
      ) : (
        <ul className="flex flex-col gap-3 [overflow-wrap:anywhere]">
          {data.tasks.map((task) => (
            <li key={task.id}>
              <Link
                href={dueMaintenanceAddress({ ...filter, maintenanceTaskId: task.id })}
                className="underline underline-offset-4"
              >
                {task.name} · {texts.counts(task.machineCount, task.overdueCount)}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/**
 * The confirmation after recording (G3): one machine by its museum number (ST-044), several by their count (ST-045) –
 * followed by one line per machine that was not recorded, with its reason (G23).
 */
function RecordedConfirmation({ confirmed }: { confirmed: Confirmed }) {
  const { museumNumbers, maintenanceTaskName, notRecorded } = confirmed;
  const several = museumNumbers.length > 1 || notRecorded.length > 0;
  return (
    <div className="flex flex-col gap-2 [overflow-wrap:anywhere]">
      <Confirmation>
        {several
          ? severalTexts.recorded(maintenanceTaskName, museumNumbers.length)
          : teamMessages.recordMaintenance.recorded(museumNumbers[0])}
      </Confirmation>
      {notRecorded.length > 0 && (
        <Rejection>
          <ul className="flex flex-col gap-1">
            {notRecorded.map(({ museumNumber, reason }) => (
              <li key={museumNumber}>
                {reason
                  ? severalTexts.notRecorded(museumNumber, commandErrorText(teamMessages, reason))
                  : severalTexts.notRecordedWithoutReason(museumNumber)}
              </li>
            ))}
          </ul>
        </Rejection>
      )}
    </div>
  );
}
