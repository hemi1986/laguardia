import { Page } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Confirmation, Rejection } from "@/components/ui/message";
import { teamMessages } from "@/platform/messages";
import { requireTeamMember } from "../../../team-session";
import { changeOwnPasswordAction } from "./actions";

const { ownPassword, accountErrors, accounts } = teamMessages;

/** The field a rejection belongs to – marked at the form (G8). */
const fieldOf: Partial<Record<keyof typeof accountErrors, "currentPassword" | "newPassword">> = {
  "current-password-wrong": "currentPassword",
  "password-too-short": "newPassword",
  "password-too-long": "newPassword",
};

/**
 * Every team member can change their own password – a technician resets a forgotten one (ADR 0004, ST-005). On the
 * house pattern (G8, G15, backlog grooming 2026-10-11): the reason of a rejection stands immediately above the submit
 * button and marks its field; a password is never shown again. The action keeps its redirect with the reason in the
 * address – ST-081 moves the account actions.
 */
export default async function OwnPasswordPage({ searchParams }: PageProps<"/team/password">) {
  await requireTeamMember();
  const { error, done } = await searchParams;
  const given = Array.isArray(error) ? error[0] : error;
  const rejection = given && Object.hasOwn(accountErrors, given) ? (given as keyof typeof accountErrors) : undefined;
  const invalid = rejection && fieldOf[rejection];

  return (
    <Page title={ownPassword.title}>
      {done === "changed" && <Confirmation>{ownPassword.changed}</Confirmation>}
      <form action={changeOwnPasswordAction} className="flex flex-col gap-5">
        <Field data-invalid={invalid === "currentPassword"}>
          <FieldLabel htmlFor="currentPassword">{ownPassword.current}</FieldLabel>
          <Input
            id="currentPassword"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
            aria-invalid={invalid === "currentPassword" || undefined}
            aria-describedby={invalid === "currentPassword" ? "password-rejection" : undefined}
          />
        </Field>
        <Field data-invalid={invalid === "newPassword"}>
          <FieldLabel htmlFor="newPassword">{ownPassword.new}</FieldLabel>
          <Input
            id="newPassword"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            required
            aria-invalid={invalid === "newPassword" || undefined}
            aria-describedby={invalid === "newPassword" ? "password-hint password-rejection" : "password-hint"}
          />
          <FieldDescription id="password-hint">{accounts.passwordHint}</FieldDescription>
        </Field>
        {rejection && (
          <div id="password-rejection">
            <Rejection>{accountErrors[rejection]}</Rejection>
          </div>
        )}
        <Button type="submit">{ownPassword.submit}</Button>
      </form>
    </Page>
  );
}
