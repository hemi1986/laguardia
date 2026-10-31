import { museumName } from "@/modules/collection";
import { database } from "@/platform/database";
import { currentVisitorMessages } from "./visitor-locale";
import { WelcomePageView } from "./welcome-page";

/**
 * The welcome page (ST-078): the museum's name (ST-100), the way to the team login and the legal links (ST-064). It
 * stays reachable without login and follows the visitor's language (ST-010).
 */
export default async function WelcomePage() {
  const [{ locale, messages }, name] = await Promise.all([currentVisitorMessages(), museumName(database())]);
  return <WelcomePageView museumName={name} locale={locale} messages={messages} />;
}
