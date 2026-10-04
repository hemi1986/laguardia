import type { ReactNode } from "react";
import { Page } from "@/components/page";
import type { VisitorLocale, VisitorMessages } from "@/platform/messages";
import { VisitorLanguageSwitch } from "./visitor-language-switch";
import { VisitorLegalLinks } from "./visitor-legal-links";

/**
 * The frame of every visitor page: its content in the visitor's language (`lang`, ST-010), the language switch at the
 * top and the links to the legal pages at the end (ST-064) – so a new visitor page cannot leave either out.
 */
export function VisitorPage({
  title,
  locale,
  messages,
  back,
  children,
}: {
  title: string;
  locale: VisitorLocale;
  messages: VisitorMessages;
  /** Where the language switch comes back to – usually the page's own path. */
  back: string;
  children: ReactNode;
}) {
  return (
    <div lang={locale}>
      <Page title={title}>
        <VisitorLanguageSwitch locale={locale} messages={messages} back={back} />
        {children}
        <VisitorLegalLinks messages={messages} />
      </Page>
    </div>
  );
}
