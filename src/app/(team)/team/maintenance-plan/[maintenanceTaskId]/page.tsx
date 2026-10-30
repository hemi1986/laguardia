import Link from "next/link";
import { BackLink } from "@/components/ui/back-link";
import { Page } from "@/components/page";
import { buttonVariants } from "@/components/ui/button";
import { maintenancePlan, maintenanceTaskName } from "@/modules/maintenance";
import { isId } from "@/platform/command";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { requireTechnician } from "../../../../team-session";
import { ChangeMaintenanceTaskForm } from "./change-maintenance-task-form";

const { maintenancePlan: texts } = teamMessages;

/**
 * Changing a maintenance task (ST-041) – reached by „Ändern“ on the maintenance plan; a page with nothing but its form
 * (G2a), under its heading how many machines it applies to and „Geräte ändern“ (ST-095). Technicians only (G11). An ID
 * that is no maintenance task shows no form.
 */
export default async function ChangeMaintenanceTaskPage({
  params,
}: PageProps<"/team/maintenance-plan/[maintenanceTaskId]">) {
  await requireTechnician();
  const { maintenanceTaskId } = await params;
  const db = database();
  const plan = isId(maintenanceTaskId) ? await maintenancePlan(db) : undefined;
  const task = plan?.maintenanceTasks.find((each) => each.id === maintenanceTaskId);
  // A removed task keeps its name: an action re-renders this page, and a rejection because it was removed meanwhile
  // must keep the form and what was typed (ST-019 review).
  const name = task?.name ?? (plan ? await maintenanceTaskName(db, maintenanceTaskId) : undefined);

  return (
    <Page title={name ? texts.changeTaskTitle(name) : texts.change}>
      {task && (
        // How many machines the task applies to, and the way to change them (ST-095) – before the first field.
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm">{texts.appliesTo(task.machineCount)}</p>
          <Link
            href={`/team/maintenance-plan/${task.id}/geraete-aendern`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            {texts.changeMachines.open}
          </Link>
        </div>
      )}
      {plan && name ? (
        <ChangeMaintenanceTaskForm
          version={plan.version}
          removed={!task}
          task={{
            id: maintenanceTaskId,
            name,
            instruction: task?.instruction ?? "",
            intervalMonths: task ? String(task.intervalMonths) : "",
            suitableForHelpers: task?.suitableForHelpers ?? false,
          }}
        />
      ) : (
        <p>{texts.notInPlan}</p>
      )}
      <BackLink href="/team/maintenance-plan">{texts.back}</BackLink>
    </Page>
  );
}
