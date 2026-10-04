import Link from "next/link";
import { Page } from "@/components/page";
import { VisitorLanguageSwitch } from "../../visitor-language-switch";
import { VisitorLegalLinks } from "../../visitor-legal-links";
import { currentVisitorMessages } from "../../visitor-locale";

/**
 * An unknown museum number (ST-010): said in the visitor's language, with HTTP status 404, the language switch (it goes
 * back to the start page – not-found knows no address) and a way on (G17).
 */
export default async function UnknownMachine() {
  const { locale, messages } = await currentVisitorMessages();
  return (
    <div lang={locale}>
      <Page title={messages.home.museum}>
        <VisitorLanguageSwitch locale={locale} messages={messages} back="/" />
        <p>{messages.machinePage.unknown}</p>
        <Link href="/" className="self-start underline underline-offset-4">
          {messages.machinePage.toStart}
        </Link>
        <VisitorLegalLinks messages={messages} />
      </Page>
    </div>
  );
}
