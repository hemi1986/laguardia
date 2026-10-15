import { Page } from "@/components/page";
import { maintenancePlan } from "@/modules/maintenance";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { requireTechnician } from "../../../team-session";
import { MaintenancePlanView } from "./maintenance-plan";

/**
 * The maintenance plan (ST-040) – technicians only (G19 row 6, behind „Mehr“). Just back from adding a maintenance
 * task, the address names it, and the page confirms it when it is in the plan.
 */
export default async function MaintenancePlanPage({ searchParams }: PageProps<"/team/maintenance-plan">) {
  await requireTechnician();
  const [plan, { added }] = await Promise.all([maintenancePlan(database()), searchParams]);

  return (
    <Page title={teamMessages.terms["Maintenance plan"]} wide>
      <MaintenancePlanView plan={plan} added={plan.maintenanceTasks.find((task) => task.id === added)} />
    </Page>
  );
}
