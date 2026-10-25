"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { activateAccount, changeRole, deactivateAccount, resetPassword, type AccountError } from "@/modules/team";
import type { Role } from "@/platform/command";
import { database } from "@/platform/database";
import { currentPerson } from "@/app/_actions/current-person";

/**
 * The actions on one account (ST-005, ST-081). They call the Team module's account functions, not commands (BC-Team
 * has no events), so they mirror the runner's contract by hand: a rejection comes back as the action's state, a
 * success lands on the team member's page with `?done=` naming what to confirm. The acting person comes from the
 * login session, never from the form – the Team module checks the role itself. A password is never kept.
 */
export type AccountActionState = { error: AccountError } | null;

/** What the team member's page confirms after an action (G3). */
export type DoneOnAccount = "role" | "password" | "deactivated" | "activated";

async function dependencies() {
  return { db: database(), actor: await currentPerson(), headers: await headers(), inNext: true };
}

function landing(teamMemberId: string, done: DoneOnAccount): never {
  redirect(`/team/members/${encodeURIComponent(teamMemberId)}?done=${done}`);
}

function role(formData: FormData): Role {
  return formData.get("role") === "technician" ? "technician" : "helper";
}

export async function changeRoleAction(
  teamMemberId: string,
  _previous: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const outcome = await changeRole({ teamMemberId, role: role(formData) }, await dependencies());
  if (!outcome.ok) return { error: outcome.error };
  landing(teamMemberId, "role");
}

export async function resetPasswordAction(
  teamMemberId: string,
  _previous: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const password = String(formData.get("password") ?? "");
  const outcome = await resetPassword({ teamMemberId, password }, await dependencies());
  if (!outcome.ok) return { error: outcome.error };
  landing(teamMemberId, "password");
}

export async function deactivateAccountAction(teamMemberId: string): Promise<AccountActionState> {
  const acting = await dependencies();
  const outcome = await deactivateAccount({ teamMemberId }, acting);
  if (!outcome.ok) return { error: outcome.error };
  // One's own account: its sessions ended with it, so the technician is logged out (ST-081).
  const own = acting.actor.kind === "team-member" && acting.actor.teamMemberId === teamMemberId;
  if (own) redirect("/login");
  landing(teamMemberId, "deactivated");
}

export async function activateAccountAction(teamMemberId: string): Promise<AccountActionState> {
  const outcome = await activateAccount({ teamMemberId }, await dependencies());
  if (!outcome.ok) return { error: outcome.error };
  landing(teamMemberId, "activated");
}
