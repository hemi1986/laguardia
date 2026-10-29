"use server";

import { redirect } from "next/navigation";
import { activateAccount, deactivateAccount, editAccount, type AccountError } from "@/modules/team";
import type { Role } from "@/platform/command";
import { database } from "@/platform/database";
import { currentPerson } from "@/app/_actions/current-person";

/**
 * The actions on one account (ST-005, ST-081, ST-088). They call the Team module's account functions, not commands
 * (BC-Team has no events), so they mirror the runner's contract by hand: a rejection comes back as the action's state, a
 * success lands on the team member's page with `?done=` naming what to confirm. The acting person comes from the
 * login session, never from the form – the Team module checks the role itself. A password is never kept.
 */
export type AccountActionState = { error: AccountError } | null;

/** What the edit page keeps after a rejection (G8) – everything but the new password. */
export type EditAccountState = { error: AccountError; values: { name: string; username: string; role?: Role } } | null;

/** What the team member's page confirms after an action (G3). */
export type DoneOnAccount = "saved" | "deactivated" | "activated";

async function dependencies() {
  return { db: database(), actor: await currentPerson() };
}

function landing(teamMemberId: string, done: DoneOnAccount): never {
  redirect(`/team/members/${encodeURIComponent(teamMemberId)}?done=${done}`);
}

/** The role a form posts – none when it posts none or an unknown one: the account keeps its role. */
function chosenRole(formData: FormData): Role | undefined {
  const role = formData.get("role");
  return role === "helper" || role === "technician" ? role : undefined;
}

export async function editAccountAction(
  teamMemberId: string,
  _previous: EditAccountState,
  formData: FormData,
): Promise<EditAccountState> {
  const values = {
    name: String(formData.get("name") ?? ""),
    username: String(formData.get("username") ?? ""),
    role: chosenRole(formData),
  };
  const newPassword = String(formData.get("newPassword") ?? "");
  const outcome = await editAccount({ teamMemberId, ...values, newPassword }, await dependencies());
  if (!outcome.ok) return { error: outcome.error, values };
  landing(teamMemberId, "saved");
}

export async function deactivateAccountAction(teamMemberId: string): Promise<AccountActionState> {
  const outcome = await deactivateAccount({ teamMemberId }, await dependencies());
  if (!outcome.ok) return { error: outcome.error };
  landing(teamMemberId, "deactivated");
}

export async function activateAccountAction(teamMemberId: string): Promise<AccountActionState> {
  const outcome = await activateAccount({ teamMemberId }, await dependencies());
  if (!outcome.ok) return { error: outcome.error };
  landing(teamMemberId, "activated");
}
