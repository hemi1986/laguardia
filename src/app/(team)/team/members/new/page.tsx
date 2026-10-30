import { BackLink } from "@/components/ui/back-link";
import { Page } from "@/components/page";
import { teamMessages } from "@/platform/messages";
import { requireTechnician } from "../../../../team-session";
import { CreateTeamMemberForm } from "./create-team-member-form";

const { accounts: texts } = teamMessages;

/** Creating a team member (ST-081) – a page of its own, without the list (G2a). Technicians only. */
export default async function NewTeamMemberPage() {
  await requireTechnician();

  return (
    <Page title={texts.newTeamMember}>
      <CreateTeamMemberForm />
      <BackLink href="/team/members">{texts.backToList}</BackLink>
    </Page>
  );
}
