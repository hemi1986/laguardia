import "server-only";
import { cookies, headers } from "next/headers";
import { visitorMessages, type VisitorLocale } from "@/platform/messages";
import { VISITOR_LOCALE_COOKIE, visitorLocale } from "@/platform/messages/visitor-locale";

/** The language of this request's visitor page (ST-010): the remembered switch, else the browser's, else English. */
export async function currentVisitorLocale(): Promise<VisitorLocale> {
  const [requestHeaders, requestCookies] = await Promise.all([headers(), cookies()]);
  return visitorLocale(
    requestHeaders.get("accept-language") ?? undefined,
    requestCookies.get(VISITOR_LOCALE_COOKIE)?.value,
  );
}

/** The visitor catalogue of this request. */
export async function currentVisitorMessages() {
  const locale = await currentVisitorLocale();
  return { locale, messages: visitorMessages(locale) };
}
