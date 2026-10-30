import { BackLink } from "@/components/ui/back-link";
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
        <BackLink href="/team/members">{accounts.backToList}</BackLink>
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
      <BackLink href={`/team/members/${account.id}`}>{texts.backToTeamMember}</BackLink>
    </Page>
  );
}
