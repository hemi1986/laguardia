import { notFound } from "next/navigation";
import { LegalPage } from "../legal-page";
import { currentVisitorMessages } from "../visitor-locale";

/** The imprint of the visitor pages (ST-064) – only if the museum provides one, else not found. */
export default async function ImprintPage() {
  const { locale, messages } = await currentVisitorMessages();
  if (!messages.legal.imprint) notFound();
  return <LegalPage text={messages.legal.imprint} locale={locale} messages={messages} path="/impressum" />;
}
