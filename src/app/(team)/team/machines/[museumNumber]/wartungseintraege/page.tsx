import { Page } from "@/components/page";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { requireTeamMember } from "../../../../../team-session";
import { loadAllMaintenanceRecords } from "./maintenance-records-data";
import { MaintenanceRecordsView } from "./maintenance-records";
import { museumNumberOfPage, teamMachinePage } from "@/app/museum-number-address";

/** Every maintenance record of one machine (ST-047) – reached from section 5 of its machine record. Every team member. */
export default async function MaintenanceRecordsPage({
  params,
  searchParams,
}: PageProps<"/team/machines/[museumNumber]/wartungseintraege">) {
  await requireTeamMember();
  const museumNumber = await museumNumberOfPage({ params, searchParams }, teamMachinePage("wartungseintraege"));
  const data = await loadAllMaintenanceRecords(database(), museumNumber);

  return (
    <Page title={data ? data.title : teamMessages.terms.Machine}>
      <MaintenanceRecordsView data={data} museumNumber={museumNumber} />
    </Page>
  );
}
