import Link from "next/link";
import { Page } from "@/components/page";
import { buttonVariants } from "@/components/ui/button";
import { currentVisitorMessages } from "./visitor-locale";
import { VisitorLanguageSwitch } from "./visitor-language-switch";

/**
 * The start page (ST-078): a public placeholder with the museum's name and the way to the team login – replaced
 * by the visitor machine page (ST-010) and the legal pages (ST-064). It stays reachable without login and follows the
 * visitor's language (ST-010).
 */
export default async function Home() {
  const { locale, messages } = await currentVisitorMessages();
  const { home } = messages;
  return (
    <Page title={home.museum}>
      <VisitorLanguageSwitch locale={locale} messages={messages} back="/" />
      <Link href="/login" className={buttonVariants({ variant: "link", className: "self-start px-0" })}>
        {home.teamLogin}
      </Link>
    </Page>
  );
}
