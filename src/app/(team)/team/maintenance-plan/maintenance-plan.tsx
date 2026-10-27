import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Confirmation } from "@/components/ui/message";
import type { ListedMaintenanceTask } from "@/modules/maintenance";
import type { MaintenancePlanConfirmation } from "./maintenance-plan-data";
import { teamMessages } from "@/platform/messages";

const { maintenancePlan: texts, terms } = teamMessages;

/**
 * The maintenance plan (RM-MaintenancePlan, ST-040): „Wartungsaufgabe hinzufügen“ directly under the heading (G2,
 * G2a), then every maintenance task with its instruction, interval, mark, how many machines it applies to (G27) and
 * „Ändern“, which leads to its change form (ST-041, G5). Texts are plain text:
 * React escapes them.
 */
export function MaintenancePlanView({
  plan,
  confirmation,
}: {
  plan: { maintenanceTasks: ListedMaintenanceTask[] };
  /** The change the technician just made – named in the confirmation (G3). */
  confirmation?: MaintenancePlanConfirmation;
}) {
  return (
    <>
      {confirmation && (
        <Confirmation>
          {confirmation.change === "machines"
            ? texts.nowAppliesTo(confirmation.name, confirmation.machineCount)
            : texts[confirmation.change](confirmation.name)}
        </Confirmation>
      )}
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
                  {texts.every(task.intervalMonths)} · {texts.appliesTo(task.machineCount)}
                  {task.suitableForHelpers && ` · ${terms["Suitable for helpers"]}`}
                </p>
                <Link
                  href={`/team/maintenance-plan/${task.id}`}
                  aria-label={texts.changeTask(task.name)}
                  className={buttonVariants({ variant: "outline", size: "sm", className: "mt-1 self-start" })}
                >
                  {texts.change}
                </Link>
              </article>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
