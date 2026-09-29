import "server-only";
import { headers } from "next/headers";
import { currentPerson as sessionPerson } from "@/modules/team";
import type { Actor } from "@/platform/command";
import { database } from "@/platform/database";

/**
 * The acting person of this request – the one place every Server Action gets it (ST-073, Q10): the logged-in team
 * member with the role stored now (ST-004), otherwise a visitor. Never from form data. ST-069 changes only this
 * function (a deactivated account is rejected instead of acting as a visitor).
 */
export async function currentPerson(): Promise<Actor> {
  return sessionPerson({ db: database(), headers: await headers(), inNext: true });
}
