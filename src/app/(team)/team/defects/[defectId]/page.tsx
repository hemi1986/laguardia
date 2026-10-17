import { Page } from "@/components/page";
import { systemClock } from "@/platform/clock";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { requireTeamMember } from "../../../../team-session";
import { claimDefectAction, releaseClaimAction, resumeDefectAction } from "./actions";
import { loadDefectDetails } from "./defect-details-data";
import { DefectDetailsView } from "./defect-details";

/**
 * A defect's own page (ST-021), opened from the open defects list – every team member; they claim it here (ST-025),
 * release its claim (ST-026) and get to resolving it (ST-028) and, as technicians, to assigning it (ST-026).
 */
export default async function DefectPage({ params, searchParams }: PageProps<"/team/defects/[defectId]">) {
  const member = await requireTeamMember();
  const [{ defectId }, query] = await Promise.all([params, searchParams]);
  const done = typeof query.done === "string" ? query.done : undefined;
  const details = await loadDefectDetails(database(), systemClock, defectId, { viewer: member, done });

  return (
    <Page title={teamMessages.terms.Defect}>
      <DefectDetailsView
        details={details}
        claimAction={details && claimDefectAction.bind(null, details.id)}
        releaseAction={details && releaseClaimAction.bind(null, details.id)}
        resumeAction={details && resumeDefectAction.bind(null, details.id)}
      />
    </Page>
  );
}
