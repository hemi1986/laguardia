import { Page } from "@/components/page";
import { systemClock } from "@/platform/clock";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { requireTeamMember } from "../../../team-session";
import { loadTriageConfirmation } from "../triage-confirmation";
import { loadTriageList } from "./triage-list-data";
import { TriageListView } from "./triage-list";

/**
 * The triage list (RM-TriageList, ST-017) – every team member: technicians triage, helpers resolve problems on the spot
 * (ST-019); technicians dismiss them (ST-020) or link them to an open defect (ST-022). Nobody logged in is sent to the login. Waiting times are computed now, on every load.
 */
export default async function TriageListPage({ searchParams }: PageProps<"/team/triage">) {
  const member = await requireTeamMember();
  const query = await searchParams;
  const [data, confirmation] = await Promise.all([
    loadTriageList(database(), systemClock),
    loadTriageConfirmation(database(), systemClock, member.id, query),
  ]);

  return (
    <Page title={teamMessages.triage.title}>
      <TriageListView data={data} confirmation={confirmation} />
    </Page>
  );
}
