import { Page } from "@/components/page";
import { systemClock } from "@/platform/clock";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { requireTeamMember } from "../../team-session";
import { loadTechnicianDashboard } from "./technician-dashboard-data";
import { TechnicianDashboard } from "./technician-dashboard";

const { team, terms } = teamMessages;

/**
 * „Übersicht“ – where logging in lands (user, 2026-10-01): technicians see the technician dashboard (ST-048); helpers
 * keep the team start page until their dashboard follows with ST-049. Navigation and logout live in the shell (ST-076).
 */
export default async function TeamStartPage() {
  const member = await requireTeamMember();
  if (member.role === "technician") {
    return (
      <Page title={team.dashboard} wide>
        <TechnicianDashboard data={await loadTechnicianDashboard(database(), systemClock)} />
      </Page>
    );
  }
  return (
    <Page title={team.start}>
      <p>
        {team.loggedInAs} {member.name} ({terms.Helper})
      </p>
    </Page>
  );
}
