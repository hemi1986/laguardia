import { Page } from "@/components/page";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { requireTechnician } from "../../../team-session";
import { MaintenancePlanView } from "./maintenance-plan";
import { loadMaintenancePlan } from "./maintenance-plan-data";

/**
 * The maintenance plan (ST-040, ST-041) – technicians only (G19 row 6, behind „Mehr“). Back from adding, changing or
 * removing a maintenance task, the address names it, and the page confirms it when the journal says this technician
 * just made that change (G3).
 */
export default async function MaintenancePlanPage({ searchParams }: PageProps<"/team/maintenance-plan">) {
  const member = await requireTechnician();
  const data = await loadMaintenancePlan(database(), member.id, await searchParams);

  return (
    <Page title={teamMessages.terms["Maintenance plan"]} wide>
      <MaintenancePlanView {...data} />
    </Page>
  );
}
