import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { currentPerson, loggedInTeamMember } from "@/modules/team";
import { database } from "@/platform/database";

/**
 * The acting person of this request – from the login session (ST-004). ST-069 moves this into the Server Action
 * runner (ST-073) as `currentPerson()`, the one way every action gets its actor.
 */
export async function actingPerson() {
  return currentPerson({ db: database(), headers: await headers(), inNext: true });
}

/** For team pages: the logged-in team member, or a redirect to the login page. Call it in every team page. */
export async function requireTeamMember() {
  const member = await loggedInTeamMember({ db: database(), headers: await headers(), inNext: true });
  if (!member) redirect("/login");
  return member;
}

/** For pages only technicians may open (ST-005): helpers are sent back to the team start page. */
export async function requireTechnician() {
  const member = await requireTeamMember();
  if (member.role !== "technician") redirect("/team");
  return member;
}
