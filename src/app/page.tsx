import { welcomePage } from "@/modules/collection";
import { database } from "@/platform/database";
import { currentVisitorMessages } from "./visitor-locale";
import { WelcomePageView } from "./welcome-page";

/**
 * The welcome page (ST-078, ST-101) at La Guardia's root address: the same for everyone, logged in or not, reachable
 * without login, in the visitor's language (ST-010). It reads the request (the language), so it is rendered for every
 * request – a change to a machine or the museum settings is visible at the next page load.
 */
export default async function WelcomePage() {
  const { locale, messages } = await currentVisitorMessages();
  const page = await welcomePage(database(), locale);
  return <WelcomePageView {...page} locale={locale} messages={messages} />;
}
