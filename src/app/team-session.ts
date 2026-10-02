import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { loggedInTeamMember } from "@/modules/team";
import { database } from "@/platform/database";

/** For team pages: the logged-in team member, or a redirect to the login page. Call it in every team page. */
export async function requireTeamMember() {
  const member = await loggedInTeamMember({ db: database(), headers: await headers(), inNext: true });
  if (!member) redirect("/login");
  return member;
}

/** The logged-in team member, if any – for pages everyone may open that show team members more (ST-011). */
export async function teamMemberIfLoggedIn() {
  return loggedInTeamMember({ db: database(), headers: await headers(), inNext: true });
}

/** For pages only technicians may open (ST-005): helpers are sent back to the team start page. */
export async function requireTechnician() {
  const member = await requireTeamMember();
  if (member.role !== "technician") redirect("/team");
  return member;
}
