import { BackLink } from "@/components/ui/back-link";
import { VisitorPage, type MuseumNamedProps } from "./visitor-page";

/** An address that leads nowhere (ST-070), named by the museum's name from the museum settings (ST-100). */
export function UnknownAddressView({ museumName, locale, messages, imprintProvided }: MuseumNamedProps) {
  return (
    <VisitorPage title={museumName} locale={locale} messages={messages} back="/" imprintProvided={imprintProvided}>
      <p>{messages.welcomePage.notFound}</p>
      <BackLink href="/">{messages.machinePage.toStart}</BackLink>
    </VisitorPage>
  );
}
