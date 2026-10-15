import { Page } from "@/components/page";
import { systemClock } from "@/platform/clock";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { requireTeamMember } from "../../../team-session";
import { dueMaintenanceFilterOf, loadDueMaintenance } from "./due-maintenance-data";
import { DueMaintenanceView } from "./due-maintenance";

/** The due maintenance list (ST-043) – „Wartung“ in the navigation, for every team member (G19 row 5). */
export default async function DueMaintenancePage({ searchParams }: PageProps<"/team/maintenance">) {
  await requireTeamMember();
  const data = await loadDueMaintenance(database(), systemClock, dueMaintenanceFilterOf(await searchParams));

  return (
    <Page title={teamMessages.dueMaintenance.title} wide>
      <DueMaintenanceView data={data} />
    </Page>
  );
}
