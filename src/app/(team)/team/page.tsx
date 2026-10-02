import Link from "next/link";
import { Page } from "@/components/page";
import { teamMessages } from "@/platform/messages";
import { requireTeamMember } from "../../team-session";

const { team, terms } = teamMessages;

/**
 * Team start page – the dashboards (ST-048 ff.) replace it. Navigation and logout live in the shell (ST-076). The
 * machine overview is linked here until ST-008 decides the team navigation (G19; user, 2026-10-01).
 */
export default async function TeamStartPage() {
  const member = await requireTeamMember();
  return (
    <Page title={team.start}>
      <p>
        {team.loggedInAs} {member.name} ({member.role === "technician" ? terms.Technician : terms.Helper})
      </p>
      <Link href="/team/machines" className="self-start underline underline-offset-4">
        {team.machines}
      </Link>
    </Page>
  );
}
