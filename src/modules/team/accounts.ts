import "server-only";
import { APIError } from "better-auth/api";
import { and, asc, count, eq, sql } from "drizzle-orm";
import type { Actor, Database, Role } from "@/platform/command";
import {
  editedAccountRejection,
  newAccountRejection,
  normalizedUsername,
  passwordRejection,
  type AccountRuleError,
} from "./account-rules";
import { authFor } from "./auth";
import { loggedInTeamMember } from "./login";
import { account, session, teamMember } from "./schema";

/**
 * Managing team member accounts (ST-005, ADR 0004): technicians create accounts, edit them – name, username, role, a
 * new password (ST-088) – and deactivate and activate them. BC-Team is generic and has no aggregates or events (`docs/domain/events.yaml`), so these are
 * module functions rather than commands – which is why each one checks the acting person's role itself.
 */
export type AccountError =
  | AccountRuleError
  | "not-authorized"
  | "username-taken"
  | "not-found"
  | AccountRefusal
  | "current-password-wrong";

export type AccountOutcome = { ok: true; teamMemberId: string } | { ok: false; error: AccountError };

type Dependencies = { db: Database; actor: Actor };

/**
 * Changing one's own password goes through Better Auth, which checks the session behind the request itself – so it
 * needs the request headers, and the type demands them where it is used.
 */
type WithSession = { headers: Headers; inNext?: boolean };

function isTechnician(actor: Actor): actor is Actor & { kind: "team-member" } {
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

/** PostgreSQL's unique violation – Drizzle wraps the driver's error ("Failed query …"), so the code is in a cause. */
function isUniqueViolation(error: unknown): boolean {
  for (let cause = error; typeof cause === "object" && cause !== null; cause = (cause as { cause?: unknown }).cause) {
    if ("code" in cause && cause.code === "23505") return true;
  }
  return false;
}

/**
 * Better Auth's own duplicate checks – the e-mail it rejects is `<username>@users.invalid` (ADR 0006), and its username
 * plugin checks the username itself when the other account was stored between our check and its insert.
 */
function isAlreadyTaken(error: unknown): boolean {
  return (
    error instanceof APIError &&
    (error.body?.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL" || error.body?.code === "USERNAME_IS_ALREADY_TAKEN")
  );
}

/**
 * What a technician changes on the account edit page (ST-088): name, username, role and – when not empty – a new
 * password, in one change. `role` left out keeps it (one's own edit page posts none).
 */
export type AccountEdit = { name: string; username: string; role?: Role; newPassword: string };

/**
 * Edits an account (ST-088): every rejection is decided before anything is written, and the change is stored in one
 * transaction – a valid new password is not set when the username of the same change is rejected. Only a new
 * password ends the team member's sessions; a new name, username or role keeps them (sessions belong to the team
 * member, not to the username).
 */
export async function editAccount(
  input: AccountEdit & { teamMemberId: string },
  { db, actor }: Dependencies,
): Promise<AccountOutcome> {
  if (!isTechnician(actor)) return { ok: false, error: "not-authorized" };
  const { teamMemberId, ...edit } = input;
  return applyChange(db, actor, teamMemberId, { edit });
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
 * Deactivates an account: it can no longer log in and its open sessions end at once. The team member's name stays on
 * everything they did – accounts are never deleted (ST-005, Out of Scope). It can be activated again (ST-081, G10a).
 * One's own account is not deactivated (ST-088): it would log the technician out with nobody to undo it.
 */
export async function deactivateAccount(
  input: { teamMemberId: string },
  { db, actor }: Dependencies,
): Promise<AccountOutcome> {
  if (!isTechnician(actor)) return { ok: false, error: "not-authorized" };
  return applyChange(db, actor, input.teamMemberId, { deactivate: true });
}

/** Activates a deactivated account again (ST-081, G10a): its team member logs in again with their password. */
export async function activateAccount(
  input: { teamMemberId: string },
  { db, actor }: Dependencies,
): Promise<AccountOutcome> {
  if (!isTechnician(actor)) return { ok: false, error: "not-authorized" };
  return applyChange(db, actor, input.teamMemberId, { activate: true });
}

/** What a change does to an account. An edit's new role and deactivation can take an active technician away. */
type Change = { edit: AccountEdit } | { deactivate: true } | { activate: true };

type AccountState = { id: string; name: string; username: string | null; role: string | null; banned: boolean | null };

type AccountRefusal = "account-deactivated" | "own-role" | "own-password" | "own-deactivation" | "last-technician";

/**
 * The one rule of what may be done to an account (ST-005, ST-081, ST-088) – asked by every change and by the account's
 * pages, so they offer exactly what the change would accept (G11). A deactivated account can only be activated again.
 * One's own role and password are not changed here and one's own account is not deactivated – „Passwort ändern“
 * proves the current password, and only another technician can undo the rest. The invariant of BC-Team: at least one
 * active technician always remains, so the team can never lock itself out.
 */
function changeRefusal(
  target: AccountState,
  change: Change,
  { actingTeamMemberId, activeTechnicians }: { actingTeamMemberId: string; activeTechnicians: number },
): AccountRefusal | undefined {
  if (target.banned && !("activate" in change)) return "account-deactivated";
  if (target.id === actingTeamMemberId) {
    if ("deactivate" in change) return "own-deactivation";
    if ("edit" in change && change.edit.role && change.edit.role !== target.role) return "own-role";
    if ("edit" in change && change.edit.newPassword) return "own-password";
  }
  if (takesAnActiveTechnicianAway(target, change) && activeTechnicians <= 1) return "last-technician";
  return undefined;
}

/**
 * Every change that could take an active technician away is serialized on one advisory lock, so two technicians
 * demoting or deactivating each other at the same time wait for each other and the second one sees the first one's
 * result – exactly one gets through.
 */
const ACTIVE_TECHNICIANS_LOCK = "team:active-technicians";

async function applyChange(
  db: Database,
  actor: Actor & { kind: "team-member" },
  teamMemberId: string,
  change: Change,
): Promise<AccountOutcome> {
  const rejection = "edit" in change ? editedAccountRejection(change.edit) : undefined;
  // Hashed before the transaction (it takes a while) and written inside it, so the password is stored with the rest
  // of the change or not at all – Better Auth's own endpoint would write it on a connection of its own.
  const newPassword = "edit" in change && change.edit.newPassword && !rejection;
  const passwordHash = newPassword ? await (await authFor(db).$context).password.hash(change.edit.newPassword) : null;
  try {
    return await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${ACTIVE_TECHNICIANS_LOCK}))`);
      const target = await accountState(tx, teamMemberId);
      if (!target) return { ok: false, error: "not-found" };
      const refusal = changeRefusal(target, change, {
        actingTeamMemberId: actor.teamMemberId,
        activeTechnicians: await activeTechnicianCount(tx),
      });
      if (refusal) return { ok: false, error: refusal };
      if (rejection) return { ok: false, error: rejection };

      if ("edit" in change) {
        const username = normalizedUsername(change.edit.username);
        if (username !== target.username && (await usernameTaken(tx, username)))
          return { ok: false, error: "username-taken" };
        await tx
          .update(teamMember)
          .set({
            name: change.edit.name.trim(),
            username,
            displayUsername: username,
            email: `${username}@users.invalid`, // kept in step with the username, as when it was created (ADR 0006)
            role: change.edit.role ?? target.role,
          })
          .where(eq(teamMember.id, teamMemberId));
        if (passwordHash) await setPassword(tx, teamMemberId, passwordHash);
      } else {
        await tx
          .update(teamMember)
          .set({ banned: "deactivate" in change })
          .where(eq(teamMember.id, teamMemberId));
      }
      // A deactivated account acts as nobody from now on, and a new password is the remedy for a lost phone or a
      // password someone else learned – either way the open sessions end with it (ST-004, ST-088).
      if ("deactivate" in change || passwordHash) await tx.delete(session).where(eq(session.userId, teamMemberId));
      return { ok: true, teamMemberId };
    });
  } catch (error) {
    // Two technicians giving the same username at the same time: the unique index decides, the loser is told.
    if (isUniqueViolation(error)) return { ok: false, error: "username-taken" };
    throw error;
  }
}

async function setPassword(db: Database, teamMemberId: string, passwordHash: string) {
  const updated = await db
    .update(account)
    .set({ password: passwordHash })
    .where(and(eq(account.userId, teamMemberId), eq(account.providerId, "credential")))
    .returning({ id: account.id });
  if (updated.length !== 1) throw new Error(`team_member ${teamMemberId}: no password login to set`);
}

async function accountState(db: Database, teamMemberId: string): Promise<AccountState | undefined> {
  const [found] = await db.select(accountColumns).from(teamMember).where(eq(teamMember.id, teamMemberId));
  return found;
}

function takesAnActiveTechnicianAway(target: AccountState, change: Change): boolean {
  const isActiveTechnician = target.role === "technician" && !target.banned;
  const demoted = "edit" in change && change.edit.role !== undefined && change.edit.role !== "technician";
  return isActiveTechnician && ("deactivate" in change || demoted);
}

const notBanned = sql`coalesce(${teamMember.banned}, false) = false`;

async function activeTechnicianCount(db: Database): Promise<number> {
  const [{ active }] = await db
    .select({ active: count() })
    .from(teamMember)
    .where(and(eq(teamMember.role, "technician"), notBanned));
  return active;
}

/** What a page shows of an account – and `banned`, from which `active` follows. */
const accountColumns = {
  id: teamMember.id,
  name: teamMember.name,
  username: teamMember.username,
  role: teamMember.role,
  banned: teamMember.banned,
};

export type TeamMemberAccount = { id: string; name: string; username: string; role: Role; active: boolean };

/**
 * Read model: the accounts with their roles, for the technicians' team members page (ST-005). Deactivated accounts are
 * listed only when asked for (ST-081) – they are never deleted.
 */
export async function teamMemberAccounts(
  db: Database,
  { includeDeactivated = true }: { includeDeactivated?: boolean } = {},
): Promise<TeamMemberAccount[]> {
  const rows = await db
    .select(accountColumns)
    .from(teamMember)
    .where(includeDeactivated ? undefined : notBanned)
    .orderBy(asc(teamMember.name));
  return rows.map(accountOf);
}

function accountOf(row: AccountState): TeamMemberAccount {
  return {
    id: row.id,
    name: row.name,
    username: row.username ?? missing("username", row.id),
    role: roleOf(row),
    active: !row.banned,
  };
}

function roleOf(row: { id: string; role: string | null }): Role {
  if (row.role !== "helper" && row.role !== "technician") return missing("role", row.id);
  return row.role;
}

function missing(column: string, id: string): never {
  throw new Error(`team_member ${id}: ${column} is missing`);
}

/**
 * What a technician may do to one account (ST-081, ST-088), each answered by the rule the change itself applies:
 * editing it – and on the edit page whether the role can be chosen and a new password set –, deactivating, activating
 * it again.
 */
export type AccountActions = {
  edit?: { chooseRole: boolean; newPassword: boolean };
  deactivate: boolean;
  activate: boolean;
};

export type TeamMemberAccountWithActions = TeamMemberAccount & { actions: AccountActions };

/**
 * Read model: one team member's account with the actions it offers to the technician looking at it, for the team
 * member's page and the account edit page (ST-081, ST-088).
 */
export async function teamMemberAccount(
  db: Database,
  teamMemberId: string,
  viewerId: string,
): Promise<TeamMemberAccountWithActions | undefined> {
  const row = await accountState(db, teamMemberId);
  if (!row) return undefined;
  const account = accountOf(row);
  const facts = { actingTeamMemberId: viewerId, activeTechnicians: await activeTechnicianCount(db) };
  const offered = (change: Change) => !changeRefusal(row, change, facts);
  const unchanged: AccountEdit = { name: account.name, username: account.username, role: account.role, newPassword: "" };
  const otherRole: Role = account.role === "technician" ? "helper" : "technician";
  return {
    ...account,
    actions: {
      edit: offered({ edit: unchanged })
        ? {
            chooseRole: offered({ edit: { ...unchanged, role: otherRole } }),
            newPassword: offered({ edit: { ...unchanged, newPassword: "a new password" } }),
          }
        : undefined,
      deactivate: offered({ deactivate: true }),
      activate: !account.active && offered({ activate: true }),
    },
  };
}
