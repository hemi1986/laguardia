import Link from "next/link";
import { VisitorPage } from "../../visitor-page";
import { currentVisitorMessages } from "../../visitor-locale";

/**
 * An unknown museum number (ST-010): said in the visitor's language, with HTTP status 404, the language switch (it goes
 * back to the start page – not-found knows no address) and a way on (G17).
 */
export default async function UnknownMachine() {
  const { locale, messages } = await currentVisitorMessages();
  return (
    <VisitorPage title={messages.home.museum} locale={locale} messages={messages} back="/">
      <p>{messages.machinePage.unknown}</p>
      <Link href="/" className="self-start underline underline-offset-4">
        {messages.machinePage.toStart}
      </Link>
    </VisitorPage>
  );
}
