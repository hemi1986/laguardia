import { BackLink } from "@/components/ui/back-link";
import { Page } from "@/components/page";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { requireTechnician } from "../../../../../team-session";
import { loadChangeMachines } from "./change-machines-data";
import { ChangeMachinesForm } from "./change-machines-form";

const { maintenancePlan: texts } = teamMessages;

/**
 * Changing the machines of a maintenance task (ST-095) – reached by „Geräte ändern“ on the task's page; a page with
 * nothing but its form (G2a), headed „Geräte ändern · <task>“ (G34). Technicians only (G11). An ID that is no
 * maintenance task shows no form.
 */
export default async function ChangeMachinesPage({
  params,
}: PageProps<"/team/maintenance-plan/[maintenanceTaskId]/geraete-aendern">) {
  await requireTechnician();
  const { maintenanceTaskId } = await params;
  const { task, groups, chosen } = await loadChangeMachines(database(), maintenanceTaskId);

  return (
    <Page title={task ? texts.changeMachines.title(task.name) : texts.changeMachines.open}>
      {task ? (
        <ChangeMachinesForm maintenanceTaskId={task.id} groups={groups} chosen={chosen} removed={task.removed} />
      ) : (
        <p>{texts.notInPlan}</p>
      )}
      <BackLink href={task ? `/team/maintenance-plan/${task.id}` : "/team/maintenance-plan"}>
        {task ? texts.changeMachines.back : texts.back}
      </BackLink>
    </Page>
  );
}
