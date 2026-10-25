import Link from "next/link";
import { redirect } from "next/navigation";
import { Page } from "@/components/page";
import { buttonVariants } from "@/components/ui/button";
import { teamMemberAccount } from "@/modules/team";
import { isId } from "@/platform/command";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { requireTechnician } from "../../../../../team-session";
import { AccountButtonForm } from "../account-forms";
import { deactivateAccountAction } from "../actions";

const { deactivateAccount: texts, accounts } = teamMessages;

/**
 * The question before deactivating an account (ST-081, G10, G10b): a page of its own that names the team member and
 * what nobody sees from here – they are logged out at once. „Konto deaktivieren“ carries it out, „Zurück“ is a link
 * back to their page and changes nothing. No „Endgültig“: the account can be activated again (G10a).
 */
export default async function DeactivateAccountPage({
  params,
}: PageProps<"/team/members/[teamMemberId]/deaktivieren">) {
  const viewer = await requireTechnician();
  const { teamMemberId } = await params;
  const account = isId(teamMemberId) ? await teamMemberAccount(database(), teamMemberId) : undefined;
  if (!account?.actions.deactivate) redirect(account ? `/team/members/${account.id}` : "/team/members");
  const own = account.id === viewer.id;
  const firstName = account.name.trim().split(/\s+/)[0];

  return (
    <Page title={accounts.title}>
      <p className="font-medium">{own ? texts.ownQuestion : texts.question(account.name, firstName)}</p>
      <div className="flex flex-wrap items-start gap-2">
        <AccountButtonForm
          action={deactivateAccountAction.bind(null, account.id)}
          label={texts.confirm}
          variant="destructive"
        />
        <Link href={`/team/members/${account.id}`} className={buttonVariants({ variant: "outline" })}>
          {texts.back}
        </Link>
      </div>
    </Page>
  );
}
