import "server-only";
import { APIError } from "better-auth/api";
import { and, asc, eq, gt, lt, sql } from "drizzle-orm";
import { systemClock, type Clock } from "@/platform/clock";
import type { Actor, Database } from "@/platform/command";
import { authFor } from "./auth";
import { failedLogin } from "./schema";

/**
 * Logging in and out, and the acting person of a request (ST-004).
 * Throttling: 10 failed logins for a username within 15 minutes lock it for 15 minutes; while locked the password
 * is not checked. Failures are counted per username, whether the account exists or not.
 */
const LOCK_AFTER = 10;
const WINDOW_MS = 15 * 60_000;

export type LoginOutcome = { ok: true; cookies: string[] } | { ok: false; error: "login-failed" | "login-locked" };

type Dependencies = { db: Database; headers?: Headers; clock?: Clock; inNext?: boolean };

export async function logIn(
  input: { username: string; password: string },
  { db, headers = new Headers(), clock = systemClock, inNext }: Dependencies,
): Promise<LoginOutcome> {
  const username = input.username.trim().toLowerCase();
  const now = clock.now();
  // Reserve the attempt as a failure first, one attempt per username at a time: a burst of parallel attempts cannot
  // all pass the lock check. The short transaction holds no connection while the password is checked.
  const reservation = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${"login:" + username}))`);
    // Failed logins only matter for the lock – forget them after twice the window.
    await tx.delete(failedLogin).where(lt(failedLogin.failedAt, new Date(now.getTime() - 2 * WINDOW_MS)));
    if (await isLocked(tx, username, now)) return undefined;
    const [row] = await tx.insert(failedLogin).values({ username, failedAt: now }).returning({ id: failedLogin.id });
    return row.id;
  });
  if (!reservation) return { ok: false, error: "login-locked" };
  const release = () => db.delete(failedLogin).where(eq(failedLogin.id, reservation));
  try {
    const { headers: responseHeaders } = await authFor(db, inNext).api.signInUsername({
      body: { username, password: input.password },
      headers,
      returnHeaders: true,
    });
    await release();
    return { ok: true, cookies: responseHeaders.getSetCookie() };
  } catch (error) {
    if (!(error instanceof APIError)) {
      await release(); // an outage is not a failed login
      throw error;
    }
    // The reservation stays as the failure. Same answer for an unknown username and a wrong password.
    return { ok: false, error: "login-failed" };
  }
}

async function isLocked(db: Database, username: string, now: Date): Promise<boolean> {
  const failures = await db
    .select({ at: failedLogin.failedAt })
    .from(failedLogin)
    .where(and(eq(failedLogin.username, username), gt(failedLogin.failedAt, new Date(now.getTime() - 2 * WINDOW_MS))))
    .orderBy(asc(failedLogin.failedAt));
  // Locked for 15 minutes from every failure that completes 10 failures within 15 minutes.
  for (let i = LOCK_AFTER - 1; i < failures.length; i++) {
    const tenth = failures[i].at.getTime();
    const first = failures[i - LOCK_AFTER + 1].at.getTime();
    if (tenth - first <= WINDOW_MS && now.getTime() < tenth + WINDOW_MS) return true;
  }
  return false;
}

/** The acting person of a request: the logged-in team member with the role stored now, or a visitor. */
export async function currentPerson({ db, headers = new Headers(), inNext }: Dependencies): Promise<Actor> {
  const found = await authFor(db, inNext).api.getSession({ headers });
  if (!found || found.user.banned) return { kind: "visitor" };
  const role = found.user.role;
  if (role !== "helper" && role !== "technician") throw new Error(`Team member ${found.user.id} has no valid role`);
  return { kind: "team-member", teamMemberId: found.user.id, role };
}

/** The logged-in team member with name and role, for pages – undefined for a visitor. */
export async function loggedInTeamMember({
  db,
  headers = new Headers(),
  inNext,
}: Dependencies): Promise<{ id: string; name: string; role: "helper" | "technician" } | undefined> {
  const person = await currentPerson({ db, headers, inNext });
  if (person.kind !== "team-member") return undefined;
  const found = await authFor(db, inNext).api.getSession({ headers });
  return found ? { id: person.teamMemberId, name: found.user.name, role: person.role } : undefined;
}

export async function logOut({ db, headers = new Headers(), inNext }: Dependencies): Promise<void> {
  await authFor(db, inNext).api.signOut({ headers });
}
