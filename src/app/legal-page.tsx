import type { LegalText, VisitorLocale, VisitorMessages } from "@/platform/messages";
import { VisitorPage } from "./visitor-page";

/**
 * A legal page of the visitor pages (ST-064) – the privacy notice or the imprint, as the museum provides it, in the
 * visitor's language with the language switch like every visitor page.
 */
export function LegalPage({
  text,
  locale,
  messages,
  path,
}: {
  text: LegalText;
  locale: VisitorLocale;
  messages: VisitorMessages;
  /** The page's own path, where the language switch comes back to. */
  path: string;
}) {
  return (
    <VisitorPage title={text.title} locale={locale} messages={messages} back={path}>
      {text.sections.map((section, index) => (
        <section key={index} className="flex flex-col gap-2">
          <h2 className="font-medium">{section.heading}</h2>
          {section.paragraphs.map((paragraph, paragraphIndex) => (
            <p key={paragraphIndex}>{paragraph}</p>
          ))}
        </section>
      ))}
    </VisitorPage>
  );
}
