import { Page } from "@/components/page";
import { systemClock } from "@/platform/clock";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { requireTeamMember } from "../../../team-session";
import { loadDefectRecorded, loadDismissed, loadResolvedOnTheSpot, loadTriageList } from "./triage-list-data";
import { TriageListView } from "./triage-list";

/**
 * The triage list (RM-TriageList, ST-017) – every team member: technicians triage, helpers resolve problems on the spot
 * (ST-019); technicians dismiss them (ST-020). Nobody logged in is sent to the login. Waiting times are computed now, on every load.
 */
export default async function TriageListPage({ searchParams }: PageProps<"/team/triage">) {
  await requireTeamMember();
  const query = await searchParams;
  const defectId = typeof query.defectRecorded === "string" ? query.defectRecorded : undefined;
  const resolvedId = typeof query.resolvedOnTheSpot === "string" ? query.resolvedOnTheSpot : undefined;
  const dismissedId = typeof query.dismissed === "string" ? query.dismissed : undefined;
  const [data, defectRecorded, resolvedOnTheSpot, dismissed] = await Promise.all([
    loadTriageList(database(), systemClock),
    defectId ? loadDefectRecorded(database(), defectId, query.statusChanged !== undefined) : undefined,
    resolvedId ? loadResolvedOnTheSpot(database(), systemClock, resolvedId) : undefined,
    dismissedId ? loadDismissed(database(), systemClock, dismissedId) : undefined,
  ]);

  return (
    <Page title={teamMessages.triage.title} wide>
      <TriageListView
        data={data}
        defectRecorded={defectRecorded}
        resolvedOnTheSpot={resolvedOnTheSpot}
        dismissed={dismissed}
      />
    </Page>
  );
}
