import "server-only";
import { count } from "drizzle-orm";
import type { Database } from "@/platform/command";
import { authFor } from "./auth";
import { teamMember } from "./schema";

export const MIN_PASSWORD_LENGTH = 10;
/** What Better Auth's username plugin accepts at login (3–30 of a-z, 0-9, _ and .) – its createUser skips the check. */
const VALID_USERNAME = /^[a-zA-Z0-9_.]{3,30}$/;

export type FirstTechnicianOutcome =
  { ok: true } | { ok: false; error: "name-required" | "username-invalid" | "password-too-short" | "accounts-exist" };

/**
 * One-off setup (ST-004): creates the first technician account when La Guardia has none yet – afterwards
 * technicians manage accounts in the app (ST-005). Run by `npm run setup:first-technician`.
 */
export async function setUpFirstTechnician(
  db: Database,
  input: { name: string; username: string; password: string },
): Promise<FirstTechnicianOutcome> {
  const name = input.name.trim();
  const username = input.username.trim().toLowerCase();
  if (!name) return { ok: false, error: "name-required" };
  if (!VALID_USERNAME.test(username)) return { ok: false, error: "username-invalid" };
  if (input.password.length < MIN_PASSWORD_LENGTH) return { ok: false, error: "password-too-short" };
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
