import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Confirmation } from "@/components/ui/message";
import type { ListedMaintenanceTask } from "@/modules/maintenance";
import { teamMessages } from "@/platform/messages";
import { formatCalendarDate } from "@/platform/time";

const { maintenancePlan: texts, machineModels, terms } = teamMessages;

/**
 * The maintenance plan (RM-MaintenancePlan, ST-040): „Wartungsaufgabe hinzufügen“ directly under the heading (G2,
 * G2a), then every maintenance task with its instruction, interval, mark, restriction in words (G6) and – from its
 * start date – when it is first due. Texts are plain text: React escapes them.
 */
export function MaintenancePlanView({
  plan,
  added,
}: {
  plan: { maintenanceTasks: ListedMaintenanceTask[] };
  /** The maintenance task just added – named in the confirmation (G3). */
  added?: ListedMaintenanceTask;
}) {
  return (
    <>
      {added && <Confirmation>{texts.added(added.name)}</Confirmation>}
      <Link href="/team/maintenance-plan/new" className={buttonVariants({ className: "self-start" })}>
        {texts.add}
      </Link>
      {plan.maintenanceTasks.length === 0 ? (
        <p>{texts.empty}</p>
      ) : (
        <ol className="flex flex-col gap-6 [overflow-wrap:anywhere]">
          {plan.maintenanceTasks.map((task) => (
            <li key={task.id}>
              <article className="flex flex-col gap-1 text-sm">
                <h2 className="text-base font-medium">{task.name}</h2>
                <p className="whitespace-pre-line">{task.instruction}</p>
                <p className="text-muted-foreground">
                  {texts.every(task.intervalMonths)} ·{" "}
                  {task.machineCategory
                    ? texts.onlyFor(
                        [
                          machineModels.categories[task.machineCategory],
                          task.technology && machineModels.technologies[task.technology],
                        ]
                          .filter(Boolean)
                          .join(" · "),
                      )
                    : texts.allMachines}
                  {task.suitableForHelpers && ` · ${terms["Suitable for helpers"]}`}
                </p>
                <p className="text-muted-foreground">
                  {texts.startAndFirstDue(formatCalendarDate(task.startDate), formatCalendarDate(task.firstDue))}
                </p>
              </article>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
