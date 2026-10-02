import { Page } from "@/components/page";
import { Button } from "@/components/ui/button";
import { LabelledField } from "@/components/ui/labelled-field";
import { Input } from "@/components/ui/input";
import { Rejection } from "@/components/ui/message";
import { teamMessages } from "@/platform/messages";
import { logInAction } from "./actions";

const { login } = teamMessages;

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;
  return (
    <Page title={login.title}>
      <form action={logInAction} className="flex flex-col gap-4">
        <LabelledField label={login.username}>
          <Input name="username" autoComplete="username" autoCapitalize="none" required />
        </LabelledField>
        <LabelledField label={login.password}>
          <Input name="password" type="password" autoComplete="current-password" required />
        </LabelledField>
        {error === "login-failed" && <Rejection>{login.failed}</Rejection>}
        {error === "login-locked" && <Rejection>{login.locked}</Rejection>}
        <Button type="submit">{login.submit}</Button>
      </form>
    </Page>
  );
}
