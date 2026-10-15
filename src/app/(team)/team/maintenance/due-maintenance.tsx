import Link from "next/link";
import { Button } from "@/components/ui/button";
import { teamMessages } from "@/platform/messages";
import { formatCalendarDate } from "@/platform/time";
import type { DueMaintenanceData, DueMaintenanceFilter } from "./due-maintenance-data";

const { dueMaintenance: texts, terms } = teamMessages;

/** The list's address with the filter – the helpers filter is kept when a task is chosen or left. */
function addressOf({ suitableForHelpers, maintenanceTaskId }: DueMaintenanceFilter): string {
  const params = new URLSearchParams();
  if (maintenanceTaskId) params.set("task", maintenanceTaskId);
  if (suitableForHelpers) params.set("helpers", "1");
  const query = params.toString();
  return `/team/maintenance${query ? `?${query}` : ""}`;
}

/**
 * The due maintenance list (RM-DueMaintenance, ST-043, G4a): first every due maintenance task with on how many machines
 * it is due and how many of those are overdue, in words; its machines – sorted by location – only after choosing it.
 * Overdue is said in words, not only by a colour (G6a). Texts are plain text: React escapes them.
 */
export function DueMaintenanceView({ data }: { data: DueMaintenanceData }) {
  const { filter, chosen } = data;
  if (chosen) {
    return (
      <section className="flex flex-col gap-4 [overflow-wrap:anywhere]">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">{chosen.name}</h2>
          <p className="text-sm whitespace-pre-line">{chosen.instruction}</p>
          {chosen.suitableForHelpers && (
            <p className="text-muted-foreground text-sm">{terms["Suitable for helpers"]}</p>
          )}
          <p className="text-sm">{texts.counts(chosen.machines.length, chosen.overdue)}</p>
        </div>
        <ol className="flex flex-col gap-4">
          {chosen.machines.map((machine) => (
            <li key={machine.machineId}>
              <article className="flex flex-col gap-1 text-sm">
                <p>
                  <Link
                    href={`/team/machines/${encodeURIComponent(machine.museumNumber)}`}
                    className="font-medium underline underline-offset-4"
                  >
                    {machine.museumNumber}
                  </Link>{" "}
                  · {machine.machineModelTitle}
                </p>
                <p>{machine.location}</p>
                <p className="text-muted-foreground">
                  {texts.lastDoneAndDue(formatCalendarDate(machine.lastDone), formatCalendarDate(machine.dueSince))}
                </p>
                {machine.overdue && <p className="font-medium">{texts.overdue}</p>}
              </article>
            </li>
          ))}
        </ol>
        <Link
          href={addressOf({ ...filter, maintenanceTaskId: undefined })}
          className="self-start text-sm underline underline-offset-4"
        >
          {texts.allDue}
        </Link>
      </section>
    );
  }
  return (
    <>
      <form method="get" action="/team/maintenance" className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="helpers"
            value="1"
            defaultChecked={filter.suitableForHelpers ?? false}
            className="size-4"
          />
          {texts.onlySuitableForHelpers}
        </label>
        <Button type="submit" variant="outline" size="sm">
          {texts.filter}
        </Button>
      </form>
      {data.tasks.length === 0 ? (
        <p>{filter.suitableForHelpers ? texts.nothingDueForHelpers : texts.nothingDue}</p>
      ) : (
        <ul className="flex flex-col gap-3 [overflow-wrap:anywhere]">
          {data.tasks.map((task) => (
            <li key={task.id}>
              <Link
                href={addressOf({ ...filter, maintenanceTaskId: task.id })}
                className="underline underline-offset-4"
              >
                {task.name} · {texts.counts(task.machines, task.overdue)}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
