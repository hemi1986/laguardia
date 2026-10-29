"use server";

import { cookies } from "next/headers";
import { RedirectType, redirect } from "next/navigation";
import { DESIGN_COOKIE, deviceDesign } from "../design";
import { sameSitePath } from "../same-site-path";

/** The longest a browser keeps a cookie – the choice stays on the device. */
const FOUR_HUNDRED_DAYS = 400 * 24 * 60 * 60;

/**
 * The design switch under „Mehr“ (ST-090, G26): remembers the chosen design on this device and shows the same page
 * again, with the same address. A Server Action, so it works without JavaScript and sits under the proxy's Origin check.
 * It changes nothing but this browser's cookie – no account, no command –, like the visitor's language switch. Only a
 * path of this site is followed back.
 */
export async function switchDesign(formData: FormData): Promise<void> {
  const design = deviceDesign(String(formData.get("design")));
  if (design) {
    (await cookies()).set(DESIGN_COOKIE, design, {
      maxAge: FOUR_HUNDRED_DAYS,
      sameSite: "lax",
      path: "/",
      httpOnly: true,
    });
  }
  // Replace, not push: the same page again must not cost the team member a step back.
  redirect(sameSitePath(String(formData.get("back") ?? "/team")), RedirectType.replace);
}
