import { Page } from "@/components/page";
import { systemClock } from "@/platform/clock";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { requireTeamMember } from "../../../../team-session";
import { loadDefectDetails } from "./defect-details-data";
import { DefectDetailsView } from "./defect-details";

/** A defect's own page (ST-021), opened from the open defects list – every team member. */
export default async function DefectPage({ params }: PageProps<"/team/defects/[defectId]">) {
  await requireTeamMember();
  const { defectId } = await params;
  const details = await loadDefectDetails(database(), systemClock, defectId);

  return (
    <Page title={teamMessages.terms.Defect}>
      <DefectDetailsView details={details} />
    </Page>
  );
}
