import { Page } from "@/components/page";
import { systemClock } from "@/platform/clock";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { requireTeamMember } from "../../team-session";
import { HelperDashboard } from "./helper-dashboard";
import { loadHelperDashboard } from "./helper-dashboard-data";
import { loadTechnicianDashboard } from "./technician-dashboard-data";
import { TechnicianDashboard } from "./technician-dashboard";
import { VisitRecorder } from "./visit-recorder";

const { team } = teamMessages;

/**
 * „Übersicht“ – where logging in lands (user, 2026-10-01): technicians see the technician dashboard (ST-048), helpers the
 * helper dashboard (ST-049). Navigation and logout live in the shell (ST-076). Both mark what is new since the Last
 * visit (ST-050), which `VisitRecorder` records once the page is shown – never this render (ADR 0011).
 */
export default async function DashboardPage() {
  const member = await requireTeamMember();
  if (member.role === "technician") {
    return (
      <Page title={team.dashboard} wide>
        <TechnicianDashboard data={await loadTechnicianDashboard(database(), systemClock, member)} />
        <VisitRecorder />
      </Page>
    );
  }
  return (
    <Page title={team.dashboard} wide>
      <HelperDashboard data={await loadHelperDashboard(database(), systemClock, member)} />
      <VisitRecorder />
    </Page>
  );
}
