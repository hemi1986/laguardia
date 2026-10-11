import { Page } from "@/components/page";
import { systemClock } from "@/platform/clock";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { requireTeamMember } from "../../../../team-session";
import { claimDefectAction } from "./actions";
import { loadDefectDetails } from "./defect-details-data";
import { DefectDetailsView } from "./defect-details";

/**
 * A defect's own page (ST-021), opened from the open defects list – every team member; they claim it here (ST-025)
 * and get to resolving it (ST-028).
 */
export default async function DefectPage({ params, searchParams }: PageProps<"/team/defects/[defectId]">) {
  const member = await requireTeamMember();
  const [{ defectId }, query] = await Promise.all([params, searchParams]);
  const justClaimed = query.claimed !== undefined;
  const justResolved = query.resolved !== undefined;
  const details = await loadDefectDetails(database(), systemClock, defectId, { viewer: member, justClaimed });

  return (
    <Page title={teamMessages.terms.Defect}>
      <DefectDetailsView
        details={details}
        claimAction={details && claimDefectAction.bind(null, details.id)}
        justClaimed={justClaimed}
        justResolved={justResolved}
      />
    </Page>
  );
}
