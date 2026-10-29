import Link from "next/link";
import { Page } from "@/components/page";
import type { TeamMemberAccountWithActions } from "@/modules/team";
import { teamMessages } from "@/platform/messages";
import { EditAccountForm } from "../account-forms";
import { editAccountAction } from "../actions";

const { editAccount: texts, account: accountTexts, accounts, accountErrors } = teamMessages;

/**
 * The account edit page (ST-088): headed „Konto bearbeiten · Anna Berger“ (G34), with „Zurück zum Teammitglied“
 * (G17). A deactivated account is not edited – the page says so, without fields; what the form offers on one's own
 * account is the Team module's answer (G11).
 */
export function EditAccountView({ account }: { account: TeamMemberAccountWithActions | undefined }) {
  if (!account) {
    return (
      <Page title={accounts.title}>
        <p>{accountTexts.unknown}</p>
        <Link href="/team/members" className="self-start text-sm underline underline-offset-4">
          {accounts.backToList}
        </Link>
      </Page>
    );
  }
  const offer = account.actions.edit;
  return (
    <Page title={texts.title(account.name)}>
      {offer ? (
        <EditAccountForm action={editAccountAction.bind(null, account.id)} account={account} offer={offer} />
      ) : (
        <p>{accountErrors["account-deactivated"]}</p>
      )}
      <Link href={`/team/members/${account.id}`} className="self-start text-sm underline underline-offset-4">
        {texts.backToTeamMember}
      </Link>
    </Page>
  );
}
