import { Page } from "@/components/page";
import { teamMessages } from "@/platform/messages";
import { requireTeamMember } from "../../team-session";

const { team, terms } = teamMessages;

/** Team start page – the dashboards (ST-048 ff.) replace it. Navigation and logout live in the shell (ST-076). */
export default async function TeamStartPage() {
  const member = await requireTeamMember();
  return (
    <Page title={team.start}>
      <p>
        {team.loggedInAs} {member.name} ({member.role === "technician" ? terms.Technician : terms.Helper})
      </p>
    </Page>
  );
}
