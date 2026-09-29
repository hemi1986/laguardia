import { Page } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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
    <Page title={ownPassword.title}>
      {rejection && Object.hasOwn(accountErrors, rejection) && (
        <Rejection>{accountErrors[rejection as keyof typeof accountErrors]}</Rejection>
      )}
      {done === "changed" && <Confirmation>{ownPassword.changed}</Confirmation>}
      <form action={changeOwnPasswordAction} className="flex flex-col gap-4">
        <Field label={ownPassword.current}>
          <Input name="currentPassword" type="password" autoComplete="current-password" required />
        </Field>
        <Field label={ownPassword.new} description={accounts.passwordHint}>
          <Input name="newPassword" type="password" autoComplete="new-password" required />
        </Field>
        <Button type="submit">{ownPassword.submit}</Button>
      </form>
    </Page>
  );
}
