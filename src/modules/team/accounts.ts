import "server-only";
import { APIError } from "better-auth/api";
import { and, asc, count, eq, sql } from "drizzle-orm";
import type { Actor, Database, Role } from "@/platform/command";
import { newAccountRejection, normalizedUsername, passwordRejection, type AccountRuleError } from "./account-rules";
import { authFor } from "./auth";
import { loggedInTeamMember } from "./login";
import { session, teamMember } from "./schema";

/**
 * Managing team member accounts (ST-005, ADR 0004): technicians create accounts, set the role, reset passwords and
 * deactivate accounts. BC-Team is generic and has no aggregates or events (`docs/domain/events.yaml`), so these are
 * module functions rather than commands – which is why each one checks the acting person's role itself.
 */
export type AccountError =
  AccountRuleError | "not-authorized" | "username-taken" | "not-found" | "last-technician" | "current-password-wrong";

export type AccountOutcome = { ok: true; teamMemberId: string } | { ok: false; error: AccountError };

type Dependencies = { db: Database; actor: Actor };

/**
 * Setting a password goes through Better Auth, which checks the session behind the request itself – so those
 * functions need the request headers, and the type demands them where they are used.
 */
type WithSession = { headers: Headers; inNext?: boolean };

function isTechnician(actor: Actor): boolean {
  return actor.kind === "team-member" && actor.role === "technician";
}

export async function createAccount(
  input: { name: string; username: string; password: string; role: Role },
  { db, actor }: Dependencies,
): Promise<AccountOutcome> {
  if (!isTechnician(actor)) return { ok: false, error: "not-authorized" };
  const rejection = newAccountRejection(input);
  if (rejection) return { ok: false, error: rejection };
  const username = normalizedUsername(input.username);
  if (await usernameTaken(db, username)) return { ok: false, error: "username-taken" };
  try {
    const { user } = await authFor(db).api.createUser({
      body: {
        name: input.name.trim(),
        email: `${username}@users.invalid`, // required by Better Auth, never shown or used (ADR 0006)
        password: input.password,
        role: input.role,
        data: { username },
      },
    });
    return { ok: true, teamMemberId: user.id };
  } catch (error) {
    // Two technicians creating the same username at the same time: the unique index decides, the loser is told.
    if (isUniqueViolation(error) || isAlreadyTaken(error)) return { ok: false, error: "username-taken" };
    throw error;
  }
}

async function usernameTaken(db: Database, username: string): Promise<boolean> {
  const [found] = await db.select({ id: teamMember.id }).from(teamMember).where(eq(teamMember.username, username));
  return found !== undefined;
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

/** Better Auth's own duplicate check – the e-mail it rejects is `<username>@users.invalid` (ADR 0006). */
function isAlreadyTaken(error: unknown): boolean {
  return error instanceof APIError && error.body?.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL";
}

/** Sets a team member's role. The role is read again on every request (ST-004), so it applies to the next action. */
export async function changeRole(
  input: { teamMemberId: string; role: Role },
  { db, actor }: Dependencies,
): Promise<AccountOutcome> {
  if (!isTechnician(actor)) return { ok: false, error: "not-authorized" };
  return applyChange(db, input.teamMemberId, { role: input.role });
}

/**
 * Sets a new password for a team member's account – a technician resets it on site, no e-mail (ADR 0004).
 * The account's open sessions end with it: a reset is the remedy for a lost phone or a password someone else
 * learned, and sessions live for 90 days (ST-004), so leaving them open would leave the old holder logged in.
 */
export async function resetPassword(
  input: { teamMemberId: string; password: string },
  { db, actor, headers, inNext }: Dependencies & WithSession,
): Promise<AccountOutcome> {
  if (!isTechnician(actor)) return { ok: false, error: "not-authorized" };
  const rejection = passwordRejection(input.password);
  if (rejection) return { ok: false, error: rejection };
  // The sessions go first: if setting the password then fails, the old holder is logged out and the old
  // password still works – the safe way round. Better Auth writes on its own connection, so the two cannot
  // share one transaction.
  await db.delete(session).where(eq(session.userId, input.teamMemberId));
  try {
    await authFor(db, inNext).api.setUserPassword({
      body: { userId: input.teamMemberId, newPassword: input.password },
      headers,
    });
  } catch (error) {
    if (error instanceof APIError && error.status === "NOT_FOUND") return { ok: false, error: "not-found" };
    throw error;
  }
  return { ok: true, teamMemberId: input.teamMemberId };
}

/**
 * A team member changes their own password, proving the current one – the only password change that is not a
 * technician's reset (ST-005). Better Auth checks the current password against the session behind `headers`.
 */
export async function changeOwnPassword(
  input: { currentPassword: string; newPassword: string },
  { db, headers, inNext }: { db: Database } & WithSession,
): Promise<AccountOutcome> {
  // Only the session decides whose password changes – an actor passed in beside it could name someone else.
  const member = await loggedInTeamMember({ db, headers, inNext });
  if (!member) return { ok: false, error: "not-authorized" };
  const rejection = passwordRejection(input.newPassword);
  if (rejection) return { ok: false, error: rejection };
  try {
    await authFor(db, inNext).api.changePassword({
      // Other devices are logged out: someone who changes their password because it leaked expects exactly that.
      // Better Auth issues a fresh session for this request, so the person changing it stays logged in.
      body: { currentPassword: input.currentPassword, newPassword: input.newPassword, revokeOtherSessions: true },
      headers,
    });
  } catch (error) {
    if (error instanceof APIError && error.body?.code === "INVALID_PASSWORD")
      return { ok: false, error: "current-password-wrong" };
    throw error;
  }
  return { ok: true, teamMemberId: member.id };
}

/**
 * Deactivates an account: it can no longer log in and its open sessions end at the next action. The team member's
 * name stays on everything they did – accounts are never deleted (ST-005, Out of Scope).
 */
export async function deactivateAccount(
  input: { teamMemberId: string },
  { db, actor }: Dependencies,
): Promise<AccountOutcome> {
  if (!isTechnician(actor)) return { ok: false, error: "not-authorized" };
  return applyChange(db, input.teamMemberId, { deactivate: true });
}

/** What a change does to an account: a new role, or deactivation. Both can take an active technician away. */
type Change = { role: Role } | { deactivate: true };

/**
 * The invariant of BC-Team: at least one active technician always remains, so the team can never lock itself out.
 * Every change that could take one away is serialized on one advisory lock, so two technicians demoting each other
 * at the same time wait for each other and the second one sees the first one's result – exactly one gets through.
 */
const ACTIVE_TECHNICIANS_LOCK = "team:active-technicians";

async function applyChange(db: Database, teamMemberId: string, change: Change): Promise<AccountOutcome> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${ACTIVE_TECHNICIANS_LOCK}))`);
    const [target] = await tx
      .select({ role: teamMember.role, banned: teamMember.banned })
      .from(teamMember)
      .where(eq(teamMember.id, teamMemberId));
    if (!target) return { ok: false, error: "not-found" };
    if (takesAnActiveTechnicianAway(target, change) && (await activeTechnicianCount(tx)) <= 1)
      return { ok: false, error: "last-technician" };

    await tx
      .update(teamMember)
      .set("role" in change ? { role: change.role } : { banned: true })
      .where(eq(teamMember.id, teamMemberId));
    // A deactivated account acts as nobody from now on – its open sessions end at the next action (ST-004).
    if ("deactivate" in change) await tx.delete(session).where(eq(session.userId, teamMemberId));
    return { ok: true, teamMemberId };
  });
}

function takesAnActiveTechnicianAway(target: { role: string | null; banned: boolean | null }, change: Change): boolean {
  const isActiveTechnician = target.role === "technician" && !target.banned;
  return isActiveTechnician && ("deactivate" in change || change.role !== "technician");
}

async function activeTechnicianCount(db: Database): Promise<number> {
  const [{ active }] = await db
    .select({ active: count() })
    .from(teamMember)
    .where(and(eq(teamMember.role, "technician"), sql`coalesce(${teamMember.banned}, false) = false`));
  return active;
}

export type TeamMemberAccount = { id: string; name: string; username: string; role: Role; active: boolean };

/** Read model: every account with its role, for the technicians' account list (ST-005). Deactivated ones stay. */
export async function teamMemberAccounts(db: Database): Promise<TeamMemberAccount[]> {
  const rows = await db
    .select({
      id: teamMember.id,
      name: teamMember.name,
      username: teamMember.username,
      role: teamMember.role,
      banned: teamMember.banned,
    })
    .from(teamMember)
    .orderBy(asc(teamMember.name));
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    username: row.username ?? missing("username", row.id),
    role: roleOf(row),
    active: !row.banned,
  }));
}

function roleOf(row: { id: string; role: string | null }): Role {
  if (row.role !== "helper" && row.role !== "technician") return missing("role", row.id);
  return row.role;
}

function missing(column: string, id: string): never {
  throw new Error(`team_member ${id}: ${column} is missing`);
}
