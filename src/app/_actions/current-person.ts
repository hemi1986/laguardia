import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { currentPerson as sessionPerson, DeactivatedAccount } from "@/modules/team";
import type { Actor, Database } from "@/platform/command";
import { database } from "@/platform/database";

/**
 * The acting person of this request – the one place every Server Action gets it (ST-073, Q10; ST-069): the logged-in
 * team member with the role stored now, otherwise a visitor. Never from form data, never the system. For Server
 * Actions only: it may end the session of a deactivated account, which sets a cookie.
 */
export async function currentPerson(): Promise<Actor> {
  return currentPersonOf({ db: database(), headers: await headers(), inNext: true });
}

/**
 * `currentPerson()` for a given database and request – for Server Actions only. The session of a deactivated account
 * acts as nobody, not even as a visitor: the Team module ends it, and the login is requested, so the command never
 * runs (ST-069).
 */
export async function currentPersonOf(request: { db: Database; headers: Headers; inNext?: boolean }): Promise<Actor> {
  try {
    return await sessionPerson(request);
  } catch (error) {
    if (!(error instanceof DeactivatedAccount)) throw error;
    redirect("/login");
  }
}
