import "server-only";
import { APIError } from "better-auth/api";
import { eq } from "drizzle-orm";
import type { Actor, Database, Role } from "@/platform/command";
import { authFor } from "./auth";
import { teamMember } from "./schema";

/**
 * Managing team member accounts (ST-005, ADR 0004): technicians create accounts, set the role, reset passwords and
 * deactivate accounts. BC-Team is generic and has no aggregates or events (`docs/domain/events.yaml`), so these are
 * module functions rather than commands – which is why each one checks the acting person's role itself.
 */
export type AccountError = "not-authorized" | "username-taken" | "not-found";

export type AccountOutcome = { ok: true; teamMemberId: string } | { ok: false; error: AccountError };

/**
 * `headers` are the request headers of the acting technician: Better Auth checks the session behind a password
 * change itself, so setting a password needs them (the other functions ignore them).
 */
type Dependencies = { db: Database; actor: Actor; headers?: Headers; inNext?: boolean };

function isTechnician(actor: Actor): boolean {
  return actor.kind === "team-member" && actor.role === "technician";
}

export async function createAccount(
  input: { name: string; username: string; password: string; role: Role },
  { db, actor }: Dependencies,
): Promise<AccountOutcome> {
  if (!isTechnician(actor)) return { ok: false, error: "not-authorized" };
  const username = input.username.trim().toLowerCase();
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
    if (error instanceof APIError || isUniqueViolation(error)) return { ok: false, error: "username-taken" };
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

/** Sets a team member's role. The role is read again on every request (ST-004), so it applies to the next action. */
export async function changeRole(
  input: { teamMemberId: string; role: Role },
  { db, actor }: Dependencies,
): Promise<AccountOutcome> {
  if (!isTechnician(actor)) return { ok: false, error: "not-authorized" };
  const [changed] = await db
    .update(teamMember)
    .set({ role: input.role })
    .where(eq(teamMember.id, input.teamMemberId))
    .returning({ id: teamMember.id });
  if (!changed) return { ok: false, error: "not-found" };
  return { ok: true, teamMemberId: changed.id };
}

/** Sets a new password for a team member's account – a technician resets it on site, no e-mail (ADR 0004). */
export async function resetPassword(
  input: { teamMemberId: string; password: string },
  { db, actor, headers, inNext }: Dependencies,
): Promise<AccountOutcome> {
  if (!isTechnician(actor)) return { ok: false, error: "not-authorized" };
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
