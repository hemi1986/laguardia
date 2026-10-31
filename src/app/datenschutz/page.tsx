import { notFound } from "next/navigation";
import { legalPage } from "@/modules/collection";
import { database } from "@/platform/database";
import { LegalPage } from "../legal-page";
import { currentVisitorMessages } from "../visitor-locale";

/** The privacy notice of the visitor pages (ST-064, ST-103) – public, the museum's text in the visitor's language. */
export default async function PrivacyNoticePage() {
  const { locale, messages } = await currentVisitorMessages();
  const page = await legalPage(database(), "privacy-notice", locale);
  // The German privacy notice is never empty (invariant) – there is always one.
  if (!page) notFound();
  return (
    <LegalPage title={messages.legal.privacyNoticeTitle} {...page} locale={locale} messages={messages} path="/datenschutz" />
  );
}
