import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { currentVisitorMessages } from "./visitor-locale";
import { VisitorPage } from "./visitor-page";

/**
 * The start page (ST-078): the museum's name, the way to the team login and the legal links (ST-064). It stays
 * reachable without login and follows the visitor's language (ST-010).
 */
export default async function Home() {
  const { locale, messages } = await currentVisitorMessages();
  const { home } = messages;
  return (
    <VisitorPage title={home.museum} locale={locale} messages={messages} back="/">
      <Link href="/login" className={buttonVariants({ variant: "link", className: "self-start px-0" })}>
        {home.teamLogin}
      </Link>
    </VisitorPage>
  );
}
