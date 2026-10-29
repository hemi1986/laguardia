import Link from "next/link";
import { Page } from "@/components/page";
import { buttonVariants } from "@/components/ui/button";
import { Confirmation } from "@/components/ui/message";
import type { TeamMemberAccountWithActions } from "@/modules/team";
import { teamMessages } from "@/platform/messages";
import { AccountButtonForm } from "./account-forms";
import { activateAccountAction, deactivateAccountAction } from "./actions";

const { account: texts, terms } = teamMessages;

/**
 * One team member's page (ST-081, ST-088): who they are, whether their account is active, and the buttons the Team
 * module offers on it – „Konto bearbeiten“ to the edit page and „Konto deaktivieren“ in one tap, without a question
 * (G28, G10a) and not red (G30); on a deactivated account only „Konto wieder aktivieren“. The page carries no rule of
 * its own (G11).
 */
export function AccountView({
  account,
  confirmation,
}: {
  account: TeamMemberAccountWithActions;
  /** The confirmation of the action just taken, naming the team member (G3). */
  confirmation?: string;
}) {
  const { actions } = account;
  return (
    <Page title={account.name}>
      {confirmation && <Confirmation>{confirmation}</Confirmation>}
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">{teamMessages.accounts.username}</dt>
        <dd>{account.username}</dd>
        <dt className="text-muted-foreground">{teamMessages.accounts.role}</dt>
        <dd>{account.role === "technician" ? terms.Technician : terms.Helper}</dd>
      </dl>
      <p className="text-sm">
        {texts.state}: {account.active ? texts.active : texts.deactivated}
      </p>
      <div className="flex flex-wrap items-start gap-2 empty:hidden">
        {actions.edit && (
          <Link href={`/team/members/${account.id}/bearbeiten`} className={buttonVariants({ variant: "outline" })}>
            {texts.edit}
          </Link>
        )}
        <AccountButtonForm
          action={deactivateAccountAction.bind(null, account.id)}
          label={texts.deactivate}
          offered={actions.deactivate}
        />
        <AccountButtonForm
          action={activateAccountAction.bind(null, account.id)}
          label={texts.activate}
          offered={actions.activate}
        />
      </div>
      <Link href="/team/members" className="self-start text-sm underline underline-offset-4">
        {teamMessages.accounts.backToList}
      </Link>
    </Page>
  );
}
