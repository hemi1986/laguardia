import Link from "next/link";
import { Page } from "@/components/page";
import { buttonVariants } from "@/components/ui/button";
import { Confirmation } from "@/components/ui/message";
import { teamMemberAccounts } from "@/modules/team";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { requireTechnician } from "../../../team-session";
import { TeamMembersList } from "./team-members-list";

const { accounts: texts } = teamMessages;

function only(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * The team members page (ST-081): find a team member and open their page – the actions on an account live there.
 * Creating one is reached under the heading (G2a). Technicians only; the Team module refuses helpers anyway (G11).
 */
export default async function TeamMembersPage({ searchParams }: PageProps<"/team/members">) {
  await requireTechnician();
  const query = await searchParams;
  const deactivatedShown = only(query.deaktivierte) === "1";
  const accounts = await teamMemberAccounts(database(), { includeDeactivated: deactivatedShown });
  // Creating keeps no journal (BC-Team has no events): the address names whom, the list confirms only an account it has.
  const created = accounts.find((account) => account.id === only(query.created));

  return (
    <Page title={texts.title} wide>
      <Link href="/team/members/new" className={`${buttonVariants()} self-start`}>
        {texts.newTeamMember}
      </Link>
      {created && <Confirmation>{texts.created(created.name)}</Confirmation>}
      <TeamMembersList accounts={accounts} deactivatedShown={deactivatedShown} />
    </Page>
  );
}
