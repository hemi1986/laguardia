import { LegalPage } from "../legal-page";
import { currentVisitorMessages } from "../visitor-locale";

/** The privacy notice of the visitor pages (ST-064) – public, in the visitor's language. */
export default async function PrivacyNoticePage() {
  const { locale, messages } = await currentVisitorMessages();
  return <LegalPage text={messages.legal.privacyNotice} locale={locale} messages={messages} path="/datenschutz" />;
}
