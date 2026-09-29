import { Confirmation, Rejection } from "@/components/ui/message";
import { teamMessages } from "@/platform/messages";
import { requireTeamMember } from "../../../team-session";
import { changeOwnPasswordAction } from "./actions";

const { ownPassword, accountErrors, accounts } = teamMessages;

/** Every team member can change their own password – a technician resets a forgotten one (ADR 0004, ST-005). */
export default async function OwnPasswordPage({ searchParams }: PageProps<"/team/password">) {
  await requireTeamMember();
  const { error, done } = await searchParams;
  const rejection = Array.isArray(error) ? error[0] : error;

  return (
    <main className="mx-auto flex max-w-sm flex-col gap-4 p-4">
      <h1 className="text-xl font-semibold">{ownPassword.title}</h1>
      {rejection && Object.hasOwn(accountErrors, rejection) && (
        <Rejection>{accountErrors[rejection as keyof typeof accountErrors]}</Rejection>
      )}
      {done === "changed" && <Confirmation>{ownPassword.changed}</Confirmation>}
      <form action={changeOwnPasswordAction} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          {ownPassword.current}
          <input
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
            className="border p-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          {ownPassword.new}
          <input name="newPassword" type="password" autoComplete="new-password" required className="border p-2" />
          <span className="text-sm">{accounts.passwordHint}</span>
        </label>
        <button type="submit" className="border p-2">
          {ownPassword.submit}
        </button>
      </form>
    </main>
  );
}
