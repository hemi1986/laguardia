import { systemClock } from "@/platform/clock";
import { database } from "@/platform/database";
import { requireTeamMember } from "../../../../team-session";
import { claimDefectAction, releaseClaimAction, resumeDefectAction } from "./actions";
import { doneActionOf } from "./defect-action-pages";
import { loadDefectDetails } from "./defect-details-data";
import { DefectDetailsView } from "./defect-details";

/**
 * A defect's own page (ST-021), headed by its title (ST-092, G1), opened from the open defects list – every team member; they claim it here (ST-025),
 * release its claim (ST-026) and get to resolving it (ST-028), reopening it (ST-030) and, as technicians, to assigning it (ST-026).
 */
export default async function DefectPage({ params, searchParams }: PageProps<"/team/defects/[defectId]">) {
  const member = await requireTeamMember();
  const [{ defectId }, query] = await Promise.all([params, searchParams]);
  const details = await loadDefectDetails(database(), systemClock, defectId, {
    viewer: member,
    done: doneActionOf(query.done),
  });

  return (
    <DefectDetailsView
      details={details}
      claimAction={details && claimDefectAction.bind(null, details.id)}
      releaseAction={details && releaseClaimAction.bind(null, details.id)}
      resumeAction={details && resumeDefectAction.bind(null, details.id)}
    />
  );
}
