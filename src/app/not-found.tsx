import Link from "next/link";
import { VisitorPage } from "./visitor-page";
import { currentVisitorMessages } from "./visitor-locale";

/**
 * Any address that leads nowhere, with HTTP status 404 – in the frame of the visitor pages and the visitor's language.
 * Our own page rather than Next.js' built-in one: that one renders a `<style>` element without the nonce, which the
 * Content Security Policy blocks (ST-070).
 */
export default async function NotFound() {
  const { locale, messages } = await currentVisitorMessages();
  return (
    <VisitorPage title={messages.home.museum} locale={locale} messages={messages} back="/">
      <p>{messages.home.notFound}</p>
      <Link href="/" className="self-start underline underline-offset-4">
        {messages.machinePage.toStart}
      </Link>
    </VisitorPage>
  );
}
