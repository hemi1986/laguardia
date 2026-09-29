import "server-only";
import { count } from "drizzle-orm";
import type { Database } from "@/platform/command";
import { newAccountRejection, type AccountRuleError } from "./account-rules";
import { authFor } from "./auth";
import { teamMember } from "./schema";

export type FirstTechnicianOutcome = { ok: true } | { ok: false; error: AccountRuleError | "accounts-exist" };

/**
 * One-off setup (ST-004): creates the first technician account when La Guardia has none yet – afterwards
 * technicians manage accounts in the app (ST-005). Run by `npm run setup:first-technician`.
 */
export async function setUpFirstTechnician(
  db: Database,
  input: { name: string; username: string; password: string },
): Promise<FirstTechnicianOutcome> {
  const rejection = newAccountRejection(input);
  if (rejection) return { ok: false, error: rejection };
  const name = input.name.trim();
  const username = input.username.trim().toLowerCase();
  const [{ accounts }] = await db.select({ accounts: count() }).from(teamMember);
  if (accounts > 0) return { ok: false, error: "accounts-exist" };
  await authFor(db).api.createUser({
    body: {
      name,
      email: `${username}@users.invalid`, // required by Better Auth, never shown or used (ADR 0006)
      password: input.password,
      role: "technician",
      data: { username },
    },
  });
  return { ok: true };
}
