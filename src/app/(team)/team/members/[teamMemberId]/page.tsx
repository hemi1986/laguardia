import Link from "next/link";
import { Page } from "@/components/page";
import { teamMemberAccount, type TeamMemberAccount } from "@/modules/team";
import { isId } from "@/platform/command";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { requireTechnician } from "../../../../team-session";
import { AccountView } from "./account-view";
import type { DoneOnAccount } from "./actions";

const { account: texts, accounts } = teamMessages;

/**
 * What the page confirms after an action (G3). The account functions keep no journal (BC-Team has no events, and
 * the audit trail was dropped – ST-081, Out of Scope), so the address names the action and the page confirms it only
 * when the account's state agrees: a deactivation only on a deactivated account; an activation and a saved edit only
 * on an active one, with the name as it is now (ST-088).
 */
const confirmations: Record<DoneOnAccount, (account: TeamMemberAccount) => string | undefined> = {
  saved: (account) => (account.active ? texts.accountSaved(account.name) : undefined),
  deactivated: (account) => (account.active ? undefined : texts.accountDeactivated(account.name)),
  activated: (account) => (account.active ? texts.accountActivated(account.name) : undefined),
};

function confirmationOf(done: unknown, account: TeamMemberAccount): string | undefined {
  if (typeof done !== "string" || !Object.hasOwn(confirmations, done)) return undefined;
  return confirmations[done as DoneOnAccount](account);
}

/** One team member's page (ST-081, ST-088): their account and what a technician may do to it. Technicians only. */
export default async function AccountPage({ params, searchParams }: PageProps<"/team/members/[teamMemberId]">) {
  const viewer = await requireTechnician();
  const { teamMemberId } = await params;
  const account = isId(teamMemberId) ? await teamMemberAccount(database(), teamMemberId, viewer.id) : undefined;
  if (!account) {
    return (
      <Page title={accounts.title}>
        <p>{texts.unknown}</p>
        <Link href="/team/members" className="self-start text-sm underline underline-offset-4">
          {accounts.backToList}
        </Link>
      </Page>
    );
  }
  const { done } = await searchParams;
  return <AccountView account={account} confirmation={confirmationOf(done, account)} />;
}
