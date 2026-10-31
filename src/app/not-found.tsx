import { museumName } from "@/modules/collection";
import { database } from "@/platform/database";
import { currentVisitorMessages } from "./visitor-locale";
import { UnknownAddressView } from "./unknown-address";

/**
 * Any address that leads nowhere, with HTTP status 404 – in the frame of the visitor pages and the visitor's language.
 * Our own page rather than Next.js' built-in one: that one renders a `<style>` element without the nonce, which the
 * Content Security Policy blocks (ST-070).
 */
export default async function NotFound() {
  const [{ locale, messages }, name] = await Promise.all([currentVisitorMessages(), museumName(database())]);
  return <UnknownAddressView museumName={name} locale={locale} messages={messages} />;
}
