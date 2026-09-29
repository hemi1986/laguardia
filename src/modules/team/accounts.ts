import "server-only";
import type { Actor, Database, Role } from "@/platform/command";
import { authFor } from "./auth";

/**
 * Managing team member accounts (ST-005, ADR 0004): technicians create accounts, set the role, reset passwords and
 * deactivate accounts. BC-Team is generic and has no aggregates or events (`docs/domain/events.yaml`), so these are
 * module functions rather than commands – which is why each one checks the acting person's role itself.
 */
export type AccountError = "not-authorized";

export type AccountOutcome = { ok: true; teamMemberId: string } | { ok: false; error: AccountError };

type Dependencies = { db: Database; actor: Actor };

function isTechnician(actor: Actor): boolean {
  return actor.kind === "team-member" && actor.role === "technician";
}

export async function createAccount(
  input: { name: string; username: string; password: string; role: Role },
  { db, actor }: Dependencies,
): Promise<AccountOutcome> {
  if (!isTechnician(actor)) return { ok: false, error: "not-authorized" };
  const username = input.username.trim().toLowerCase();
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
}
