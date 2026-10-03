import { Page } from "@/components/page";
import { systemClock } from "@/platform/clock";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { requireTeamMember } from "../../../team-session";
import { loadTriageList } from "./triage-list-data";
import { TriageListView } from "./triage-list";

/**
 * The triage list (RM-TriageList, ST-017) – every team member: technicians triage, helpers resolve problems on the spot
 * (ST-019). Nobody logged in is sent to the login. Waiting times are computed now, on every load.
 */
export default async function TriageListPage() {
  await requireTeamMember();
  const data = await loadTriageList(database(), systemClock);

  return (
    <Page title={teamMessages.triage.title} wide>
      <TriageListView data={data} />
    </Page>
  );
}
