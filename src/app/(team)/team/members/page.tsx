import Link from "next/link";
import { teamMemberAccounts, type TeamMemberAccount } from "@/modules/team";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { requireTechnician } from "../../../team-session";
import { changeRoleAction, createAccountAction, deactivateAccountAction, resetPasswordAction } from "./actions";

const { accounts: texts, accountErrors, terms, team } = teamMessages;

const confirmations: Record<string, string> = {
  created: texts.created,
  role: texts.roleChanged,
  password: texts.passwordReset,
  deactivated: texts.accountDeactivated,
};

function only(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** The technicians' account list (ST-005): create accounts, set the role, reset passwords, deactivate. */
export default async function TeamMembersPage({ searchParams }: PageProps<"/team/members">) {
  await requireTechnician();
  const { error, done } = await searchParams;
  const accounts = await teamMemberAccounts(database());
  const rejection = only(error);
  const confirmation = confirmations[only(done) ?? ""];

  return (
    <main className="flex flex-col gap-6 p-4">
      <h1 className="text-xl font-semibold">{texts.title}</h1>
      {rejection && rejection in accountErrors && (
        <p role="alert">{accountErrors[rejection as keyof typeof accountErrors]}</p>
      )}
      {confirmation && <p role="status">{confirmation}</p>}

      <ul className="flex flex-col gap-4">
        {accounts.map((account) => (
          <li key={account.id}>
            <Account account={account} />
          </li>
        ))}
      </ul>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">{texts.newAccount}</h2>
        <form action={createAccountAction} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            {texts.name}
            <input name="name" required className="border p-2" />
          </label>
          <label className="flex flex-col gap-1">
            {texts.username}
            <input name="username" autoCapitalize="none" required className="border p-2" />
          </label>
          <label className="flex flex-col gap-1">
            {texts.initialPassword}
            <input name="password" type="password" autoComplete="new-password" required className="border p-2" />
            <span className="text-sm">{texts.passwordHint}</span>
          </label>
          <label className="flex flex-col gap-1">
            {texts.role}
            <select name="role" defaultValue="helper" className="border p-2">
              <option value="helper">{terms.Helper}</option>
              <option value="technician">{terms.Technician}</option>
            </select>
          </label>
          <button type="submit" className="border p-2">
            {texts.create}
          </button>
        </form>
      </section>

      <Link href="/team" className="underline">
        {team.start}
      </Link>
    </main>
  );
}

/** One account with everything a technician can do to it. */
function Account({ account }: { account: TeamMemberAccount }) {
  const roleName = account.role === "technician" ? terms.Technician : terms.Helper;
  const otherRole = account.role === "technician" ? "helper" : "technician";

  return (
    <article className="flex flex-col gap-2 border p-3">
      <h2 className="font-semibold">{account.name}</h2>
      <p>
        {account.username} · {roleName}
        {!account.active && ` · ${texts.deactivated}`}
      </p>
      {account.active && (
        <>
          <form action={changeRoleAction}>
            <input type="hidden" name="teamMemberId" value={account.id} />
            <input type="hidden" name="role" value={otherRole} />
            <button type="submit" className="border p-2">
              {otherRole === "technician" ? texts.makeTechnician : texts.makeHelper}
            </button>
          </form>
          <form action={resetPasswordAction} className="flex flex-col gap-2">
            <input type="hidden" name="teamMemberId" value={account.id} />
            <label className="flex flex-col gap-1">
              {texts.newPassword}
              <input
                name="password"
                type="password"
                autoComplete="new-password"
                required
                aria-label={`${texts.newPassword} – ${account.name}`}
                className="border p-2"
              />
            </label>
            <button type="submit" className="border p-2">
              {texts.resetPassword}
            </button>
          </form>
          <form action={deactivateAccountAction}>
            <input type="hidden" name="teamMemberId" value={account.id} />
            <button type="submit" className="border p-2">
              {texts.deactivate}
            </button>
          </form>
        </>
      )}
    </article>
  );
}
