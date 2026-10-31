import type { ReactNode } from "react";
import { Page } from "@/components/page";
import type { VisitorLocale, VisitorMessages } from "@/platform/messages";
import { VisitorLanguageSwitch } from "./visitor-language-switch";
import { VisitorLegalLinks } from "./visitor-legal-links";

/** What every visitor page that names the museum gets (ST-100): its name from the museum settings, and the language. */
export type MuseumNamedProps = { museumName: string; locale: VisitorLocale; messages: VisitorMessages };

/**
 * The frame of every visitor page: its content in the visitor's language (`lang`, ST-010), the language switch at the
 * top and the links to the legal pages at the end (ST-064) – so a new visitor page cannot leave either out.
 */
export function VisitorPage({
  title,
  locale,
  messages,
  back,
  above,
  children,
}: {
  title: string;
  /** What stands above the title – the museum's logo on the welcome page (ST-102). */
  above?: ReactNode;
  locale: VisitorLocale;
  messages: VisitorMessages;
  /** Where the language switch comes back to – usually the page's own path. */
  back: string;
  children: ReactNode;
}) {
  return (
    <div lang={locale}>
      <Page title={title} above={above}>
        <VisitorLanguageSwitch locale={locale} messages={messages} back={back} />
        {children}
        <VisitorLegalLinks messages={messages} />
      </Page>
    </div>
  );
}
