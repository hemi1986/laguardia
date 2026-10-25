import Link from "next/link";
import { Page } from "@/components/page";
import { buttonVariants } from "@/components/ui/button";
import { Confirmation } from "@/components/ui/message";
import type { TeamMemberAccountWithActions } from "@/modules/team";
import { teamMessages } from "@/platform/messages";
import { AccountButtonForm, ResetPasswordForm } from "./account-forms";
import { activateAccountAction, changeRoleAction, resetPasswordAction } from "./actions";

const { account: texts, terms } = teamMessages;

/**
 * One team member's page (ST-081): who they are, whether their account is active, and the actions the Team module
 * offers on it – changing the role, resetting the password, deactivating; on a deactivated account only activating
 * it again. Deactivating leads to its question page first (G10, G10b). The page carries no rule of its own (G11).
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
      {actions.limitedBy === "last-technician" && <p className="text-sm">{texts.lastTechnician}</p>}
      {actions.changeRoleTo && (
        <AccountButtonForm
          action={changeRoleAction.bind(null, account.id)}
          role={actions.changeRoleTo}
          label={actions.changeRoleTo === "technician" ? texts.makeTechnician : texts.makeHelper}
        />
      )}
      {actions.resetPassword && <ResetPasswordForm action={resetPasswordAction.bind(null, account.id)} />}
      {actions.deactivate && (
        <Link
          href={`/team/members/${account.id}/deaktivieren`}
          className={`${buttonVariants({ variant: "destructive" })} self-start`}
        >
          {texts.deactivate}
        </Link>
      )}
      {actions.activate && (
        <AccountButtonForm action={activateAccountAction.bind(null, account.id)} label={texts.activate} />
      )}
      <Link href="/team/members" className="self-start text-sm underline underline-offset-4">
        {teamMessages.accounts.backToList}
      </Link>
    </Page>
  );
}
