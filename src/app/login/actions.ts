"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { logIn, type LoginOutcome } from "@/modules/team";
import { database } from "@/platform/database";

/**
 * After a rejected login: why, and the username that was typed – never the password (G8). The same `{ error, values }`
 * shape the Server Action runner returns; logging in is not a command (it calls the Team module's `logIn`, backed by
 * Better Auth), so this action mirrors the contract instead of running through `formAction` (backlog grooming
 * 2026-10-11).
 */
export type LogInState = {
  error: Extract<LoginOutcome, { ok: false }>["error"];
  values: { username: string };
} | null;

export async function logInAction(_previous: LogInState, formData: FormData): Promise<LogInState> {
  const username = String(formData.get("username") ?? "");
  const outcome = await logIn(
    { username, password: String(formData.get("password") ?? "") },
    { db: database(), headers: await headers(), inNext: true },
  );
  if (outcome.ok) redirect("/team");
  return { error: outcome.error, values: { username } };
}
