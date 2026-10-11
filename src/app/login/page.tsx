import { Page } from "@/components/page";
import { teamMessages } from "@/platform/messages";
import { LogInForm } from "./log-in-form";

export default function LoginPage() {
  return (
    <Page title={teamMessages.login.title}>
      <LogInForm />
    </Page>
  );
}
