import { sql } from "drizzle-orm";
import type { Actor, Database } from "@/platform/command";

/**
 * Makes an acting team member of a test exist as an account (reports and "… by" refer to team_member.id, ST-004).
 * Plain SQL: test support may not reach into the Team module's schema. Accounts with a password: the Team module's
 * own test support (`src/modules/team/accounts.test-support.ts`).
 */
export async function anExistingTeamMember(
  db: Database,
  actor: Extract<Actor, { kind: "team-member" }>,
  /** The name pages show for the team member ("Tom"); the username when none is given. */
  name?: string,
): Promise<void> {
  const username = `tm_${actor.teamMemberId.slice(0, 8)}`;
  await db.execute(sql`
    INSERT INTO team_member (id, name, email, username, role)
    VALUES (${actor.teamMemberId}, ${name ?? username}, ${`${username}@users.invalid`}, ${username}, ${actor.role})
    ON CONFLICT (id) DO NOTHING`);
}
