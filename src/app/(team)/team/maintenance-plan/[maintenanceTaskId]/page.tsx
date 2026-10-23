import Link from "next/link";
import { Page } from "@/components/page";
import { maintenancePlan } from "@/modules/maintenance";
import { isId } from "@/platform/command";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { requireTechnician } from "../../../../team-session";
import { maintenanceTaskChoices } from "../maintenance-task-choices";
import { ChangeMaintenanceTaskForm } from "./change-maintenance-task-form";

const { maintenancePlan: texts } = teamMessages;

/**
 * Changing a maintenance task (ST-041) – reached by „Ändern“ on the maintenance plan; a page with nothing but its form
 * (G2a). Technicians only (G11). A task that is not in the plan – removed, or no task at all – shows no form.
 */
export default async function ChangeMaintenanceTaskPage({
  params,
}: PageProps<"/team/maintenance-plan/[maintenanceTaskId]">) {
  await requireTechnician();
  const { maintenanceTaskId } = await params;
  const plan = isId(maintenanceTaskId) ? await maintenancePlan(database()) : undefined;
  const task = plan?.maintenanceTasks.find((each) => each.id === maintenanceTaskId);

  return (
    <Page title={task ? texts.changeTask(task.name) : texts.change}>
      {plan && task ? (
        <ChangeMaintenanceTaskForm
          version={plan.version}
          task={{
            id: task.id,
            name: task.name,
            instruction: task.instruction,
            intervalMonths: String(task.intervalMonths),
            suitableForHelpers: task.suitableForHelpers,
            machineCategory: task.machineCategory ?? "",
            technology: task.technology ?? "",
            startDate: task.startDate,
          }}
          {...maintenanceTaskChoices}
        />
      ) : (
        <p>{texts.notInPlan}</p>
      )}
      <Link href="/team/maintenance-plan" className="self-start text-sm underline underline-offset-4">
        {texts.back}
      </Link>
    </Page>
  );
}
