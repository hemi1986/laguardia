import { Page } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LabelledField } from "@/components/ui/labelled-field";
import { Input } from "@/components/ui/input";
import { Confirmation, Rejection } from "@/components/ui/message";
import { NativeSelect } from "@/components/ui/native-select";
import { teamMemberAccounts, type TeamMemberAccount } from "@/modules/team";
import { database } from "@/platform/database";
import { teamMessages } from "@/platform/messages";
import { requireTechnician } from "../../../team-session";
import { changeRoleAction, createAccountAction, deactivateAccountAction, resetPasswordAction } from "./actions";

const { accounts: texts, accountErrors, terms } = teamMessages;

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
  const confirmedStep = only(done) ?? "";
  const confirmation = Object.hasOwn(confirmations, confirmedStep) ? confirmations[confirmedStep] : undefined;

  return (
    <Page title={texts.title}>
      {rejection && Object.hasOwn(accountErrors, rejection) && (
        <Rejection>{accountErrors[rejection as keyof typeof accountErrors]}</Rejection>
      )}
      {confirmation && <Confirmation>{confirmation}</Confirmation>}

      <ul className="flex flex-col gap-4">
        {accounts.map((account) => (
          <li key={account.id}>
            <Account account={account} />
          </li>
        ))}
      </ul>

      <section className="flex flex-col gap-4">
        <h2 className="text-base font-medium">{texts.newAccount}</h2>
        <form action={createAccountAction} className="flex flex-col gap-4">
          <LabelledField label={texts.name}>
            <Input name="name" required />
          </LabelledField>
          <LabelledField label={texts.username}>
            <Input name="username" autoCapitalize="none" required />
          </LabelledField>
          <LabelledField label={texts.initialPassword} description={texts.passwordHint}>
            <Input name="password" type="password" autoComplete="new-password" required />
          </LabelledField>
          <LabelledField label={texts.role}>
            <NativeSelect name="role" defaultValue="helper">
              <option value="helper">{terms.Helper}</option>
              <option value="technician">{terms.Technician}</option>
            </NativeSelect>
          </LabelledField>
          <Button type="submit">{texts.create}</Button>
        </form>
      </section>
    </Page>
  );
}

/** One account with everything a technician can do to it. */
function Account({ account }: { account: TeamMemberAccount }) {
  const roleName = account.role === "technician" ? terms.Technician : terms.Helper;
  const otherRole = account.role === "technician" ? "helper" : "technician";

  return (
    <Card>
      <CardHeader>
        <CardTitle>{account.name}</CardTitle>
        <CardDescription>
          {account.username} · {roleName}
          {!account.active && ` · ${texts.deactivated}`}
        </CardDescription>
      </CardHeader>
      {account.active && (
        <CardContent>
          <form action={changeRoleAction}>
            <input type="hidden" name="teamMemberId" value={account.id} />
            <input type="hidden" name="role" value={otherRole} />
            <Button type="submit" variant="outline">
              {otherRole === "technician" ? texts.makeTechnician : texts.makeHelper}
            </Button>
          </form>
          <form action={resetPasswordAction} className="flex flex-col gap-2">
            <input type="hidden" name="teamMemberId" value={account.id} />
            <LabelledField label={texts.newPassword}>
              <Input
                name="password"
                type="password"
                autoComplete="new-password"
                required
                aria-label={`${texts.newPassword} – ${account.name}`}
              />
            </LabelledField>
            <Button type="submit" variant="outline">
              {texts.resetPassword}
            </Button>
          </form>
          <form action={deactivateAccountAction}>
            <input type="hidden" name="teamMemberId" value={account.id} />
            <Button type="submit" variant="destructive">
              {texts.deactivate}
            </Button>
          </form>
        </CardContent>
      )}
    </Card>
  );
}
