import { Page } from "@/components/page";
import { maintenancePlan, maintenanceTaskAddedBy } from "@/modules/maintenance";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { requireTechnician } from "../../../team-session";
import { MaintenancePlanView } from "./maintenance-plan";

/**
 * The maintenance plan (ST-040) – technicians only (G19 row 6, behind „Mehr“). Just back from adding a maintenance
 * task, the address names it, and the page confirms it when the journal says this technician just added it (G3).
 */
export default async function MaintenancePlanPage({ searchParams }: PageProps<"/team/maintenance-plan">) {
  const member = await requireTechnician();
  const [plan, { added }] = await Promise.all([maintenancePlan(database()), searchParams]);
  // Confirmed only when adding it was the latest change of the plan and this technician made it (G3).
  const confirmed = typeof added === "string" && (await maintenanceTaskAddedBy(database(), added, member.id));

  return (
    <Page title={teamMessages.terms["Maintenance plan"]} wide>
      <MaintenancePlanView
        plan={plan}
        added={confirmed ? plan.maintenanceTasks.find((task) => task.id === added) : undefined}
      />
    </Page>
  );
}
