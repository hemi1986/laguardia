import Link from "next/link";
import { Page } from "@/components/page";
import { maintenancePlan, maintenanceTaskName } from "@/modules/maintenance";
import { isId } from "@/platform/command";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { requireTechnician } from "../../../../team-session";
import { maintenanceTaskChoices } from "../maintenance-task-choices";
import { ChangeMaintenanceTaskForm } from "./change-maintenance-task-form";

const { maintenancePlan: texts } = teamMessages;

/**
 * Changing a maintenance task (ST-041) – reached by „Ändern“ on the maintenance plan; a page with nothing but its form
 * (G2a). Technicians only (G11). An ID that is no maintenance task shows no form.
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
    <Page title={name ? texts.changeTask(name) : texts.change}>
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
            machineCategory: task?.machineCategory ?? "",
            technology: task?.technology ?? "",
            startDate: task?.startDate ?? "",
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
