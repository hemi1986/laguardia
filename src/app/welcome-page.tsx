import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { VisitorPage, type MuseumNamedProps } from "./visitor-page";

/**
 * The welcome page (ST-078): the museum's name – from the museum settings, not translated (ST-100) –, the way to the team
 * login and the legal links (ST-064).
 */
export function WelcomePageView({ museumName, locale, messages }: MuseumNamedProps) {
  return (
    <VisitorPage title={museumName} locale={locale} messages={messages} back="/">
      <Link href="/login" className={buttonVariants({ variant: "link", className: "self-start px-0" })}>
        {messages.home.teamLogin}
      </Link>
    </VisitorPage>
  );
}
