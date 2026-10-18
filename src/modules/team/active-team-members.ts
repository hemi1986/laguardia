import { and, asc, eq, sql, type SQL } from "drizzle-orm";
import type { Database, Role } from "@/platform/command";
import { teamMember } from "./schema";

/** A team member whose account is active – who can be given work (ST-026). */
export type ActiveTeamMember = { id: string; name: string; role: Role };

/** As the account list and the last-technician rule say it (`accounts.ts`). */
const active = sql`coalesce(${teamMember.banned}, false) = false`;

/**
 * The team members with an active account, by name – whom a technician can assign a defect to (ST-026). As narrow as
 * that choice: no username, no deactivated account (CONTEXT.md, Account).
 */
export async function activeTeamMembers(db: Database): Promise<ActiveTeamMember[]> {
  const rows = await db
    .select({ id: teamMember.id, name: teamMember.name, role: teamMember.role })
    .from(teamMember)
    .where(active)
    .orderBy(asc(teamMember.name), asc(teamMember.id));
  return rows.flatMap((row) => (isRole(row.role) ? [{ ...row, role: row.role }] : []));
}

/**
 * The role of one team member with an active account – undefined for a deactivated or unknown one, or for something
 * that is no ID as Team spells it (lower case): the caller keeps and compares the ID it asked with, so only that one
 * spelling is a team member. What another context's command rule reads (context map, Team → all contexts): the role
 * stored now, as for the acting person.
 */
export async function activeTeamMemberRole(db: Database, teamMemberId: string): Promise<Role | undefined> {
  return roleOf(db, teamMemberId, active);
}

/**
 * The role of one team member, whether or not their account is still active – undefined for an unknown one, spelled
 * as for `activeTeamMemberRole`. For a rule about what someone is rather than whether they can be given work: removing
 * the suitable-for-helpers mark releases a helper's claim, a deactivated helper's too (ST-031).
 */
export async function teamMemberRole(db: Database, teamMemberId: string): Promise<Role | undefined> {
  return roleOf(db, teamMemberId);
}

async function roleOf(db: Database, teamMemberId: string, condition?: SQL): Promise<Role | undefined> {
  const [row] = await db
    .select({ role: teamMember.role })
    .from(teamMember)
    .where(and(eq(sql`${teamMember.id}::text`, teamMemberId), condition));
  return row && isRole(row.role) ? row.role : undefined;
}

function isRole(role: string | null): role is Role {
  return role === "helper" || role === "technician";
}
