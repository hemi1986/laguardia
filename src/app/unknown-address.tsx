import { BackLink } from "@/components/ui/back-link";
import { VisitorPage } from "./visitor-page";
import type { MuseumNamedProps } from "./welcome-page";

/** An address that leads nowhere (ST-070), named by the museum's name from the museum settings (ST-100). */
export function UnknownAddressView({ museumName, locale, messages }: MuseumNamedProps) {
  return (
    <VisitorPage title={museumName} locale={locale} messages={messages} back="/">
      <p>{messages.home.notFound}</p>
      <BackLink href="/">{messages.machinePage.toStart}</BackLink>
    </VisitorPage>
  );
}
