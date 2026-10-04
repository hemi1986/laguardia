import { Page } from "@/components/page";
import type { LegalText, VisitorLocale, VisitorMessages } from "@/platform/messages";
import { VisitorLanguageSwitch } from "./visitor-language-switch";
import { VisitorLegalLinks } from "./visitor-legal-links";

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
    <div lang={locale}>
      <Page title={text.title}>
        <VisitorLanguageSwitch locale={locale} messages={messages} back={path} />
        {text.sections.map((section) => (
          <section key={section.heading} className="flex flex-col gap-2">
            <h2 className="font-medium">{section.heading}</h2>
            {section.paragraphs.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </section>
        ))}
        <VisitorLegalLinks messages={messages} />
      </Page>
    </div>
  );
}
