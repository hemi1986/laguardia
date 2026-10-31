import { BackLink } from "@/components/ui/back-link";
import { VisitorPage, type MuseumNamedProps } from "../../visitor-page";

/**
 * An unknown museum number (ST-010), named by the museum's name from the museum settings (ST-100): said in the visitor's
 * language, with the language switch (it goes back to the start page – not-found knows no address) and a way on (G17).
 */
export function UnknownMachineView({ museumName, locale, messages, imprintProvided }: MuseumNamedProps) {
  return (
    <VisitorPage title={museumName} locale={locale} messages={messages} back="/" imprintProvided={imprintProvided}>
      <p>{messages.machinePage.unknown}</p>
      <BackLink href="/">{messages.machinePage.toStart}</BackLink>
    </VisitorPage>
  );
}
