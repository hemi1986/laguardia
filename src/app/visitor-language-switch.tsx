import type { VisitorLocale, VisitorMessages } from "@/platform/messages";
import { Button } from "@/components/ui/button";
import { switchVisitorLanguage } from "./visitor-language-action";

/** Switches a visitor page to the other language (ST-010) – a form, so it works without JavaScript. */
export function VisitorLanguageSwitch({
  locale,
  messages,
  back,
}: {
  locale: VisitorLocale;
  messages: VisitorMessages;
  back: string;
}) {
  return (
    <form action={switchVisitorLanguage} className="self-end">
      <input type="hidden" name="locale" value={locale === "de" ? "en" : "de"} />
      <input type="hidden" name="back" value={back} />
      <Button type="submit" variant="outline" size="sm" lang={locale === "de" ? "en" : "de"}>
        {messages.machinePage.switchLanguage}
      </Button>
    </form>
  );
}
