import type { VisitorLocale, VisitorMessages } from "@/platform/messages";
import { BackLink } from "@/components/ui/back-link";
import { LegalMarkdown } from "./legal-markdown";
import { VisitorPage } from "./visitor-page";

/**
 * A legal page of the visitor pages (ST-064, ST-103) – the privacy notice or the imprint as the museum wrote it in the
 * museum settings (RM-LegalPage), in the visitor's language with the language switch like every visitor page. The page's
 * title is its main heading; the text's own headings are shown one level below it.
 */
export function LegalPage({
  title,
  markdown,
  imprintProvided,
  locale,
  messages,
  path,
}: {
  title: string;
  /** The museum's text as Markdown (ADR 0013). */
  markdown: string;
  imprintProvided: boolean;
  locale: VisitorLocale;
  messages: VisitorMessages;
  /** The page's own path, where the language switch comes back to. */
  path: string;
}) {
  return (
    <VisitorPage title={title} locale={locale} messages={messages} back={path} imprintProvided={imprintProvided}>
      <LegalMarkdown text={markdown} />
      <BackLink href="/">{messages.machinePage.toStart}</BackLink>
    </VisitorPage>
  );
}
