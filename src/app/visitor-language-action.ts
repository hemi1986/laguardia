"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { VISITOR_LOCALE_COOKIE } from "@/platform/messages/visitor-locale";
import { sameSitePath } from "./same-site-path";

const YEAR = 365 * 24 * 60 * 60;


/**
 * The language switch of the visitor pages (ST-010): remembers the chosen language for a year and shows the same page
 * again. A Server Action, so it works without JavaScript and sits under the proxy's Origin check. Only a path of this
 * site is followed back – never another host.
 */
export async function switchVisitorLanguage(formData: FormData): Promise<void> {
  const locale = formData.get("locale");
  const back = String(formData.get("back") ?? "/");
  if (locale === "de" || locale === "en") {
    (await cookies()).set(VISITOR_LOCALE_COOKIE, locale, { maxAge: YEAR, sameSite: "lax", path: "/" });
  }
  redirect(sameSitePath(back));
}
