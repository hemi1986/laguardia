import { Page } from "@/components/page";
import { BackLink } from "@/components/ui/back-link";
import { teamMessages } from "@/platform/messages";
import { LogInForm } from "./log-in-form";

export default function LoginPage() {
  return (
    <Page title={teamMessages.login.title}>
      <LogInForm />
      <BackLink href="/">{teamMessages.login.toStart}</BackLink>
    </Page>
  );
}
