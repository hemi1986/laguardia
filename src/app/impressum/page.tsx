import { notFound } from "next/navigation";
import { legalPage } from "@/modules/collection";
import { database } from "@/platform/database";
import { LegalPage } from "../legal-page";
import { currentVisitorMessages } from "../visitor-locale";

/**
 * The imprint of the visitor pages (ST-064, ST-103) – only if the museum provides one, else not found; in English the
 * German imprint where no English one is provided.
 */
export default async function ImprintPage() {
  const { locale, messages } = await currentVisitorMessages();
  const page = await legalPage(database(), "imprint", locale);
  if (!page) notFound();
  return <LegalPage title={messages.legal.imprintTitle} {...page} locale={locale} messages={messages} path="/impressum" />;
}
