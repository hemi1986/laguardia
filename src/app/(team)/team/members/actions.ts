"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { changeRole, createAccount, deactivateAccount, resetPassword, type AccountOutcome } from "@/modules/team";
import type { Role } from "@/platform/command";
import { database } from "@/platform/database";
import { actingPerson } from "../../../team-session";

/**
 * Managing team member accounts (ST-005). The acting person comes from the login session, never from the form –
 * the Team module checks the role itself, the page only shows what a technician may do.
 */
const MEMBERS = "/team/members";

async function dependencies() {
  return { db: database(), actor: await actingPerson(), headers: await headers(), inNext: true };
}

function back(outcome: AccountOutcome, done: string): never {
  redirect(outcome.ok ? `${MEMBERS}?done=${done}` : `${MEMBERS}?error=${outcome.error}`);
}

function text(formData: FormData, field: string): string {
  return String(formData.get(field) ?? "");
}

function role(formData: FormData): Role {
  return text(formData, "role") === "technician" ? "technician" : "helper";
}

export async function createAccountAction(formData: FormData): Promise<void> {
  const outcome = await createAccount(
    {
      name: text(formData, "name"),
      username: text(formData, "username"),
      password: text(formData, "password"),
      role: role(formData),
    },
    await dependencies(),
  );
  back(outcome, "created");
}

export async function changeRoleAction(formData: FormData): Promise<void> {
  const outcome = await changeRole(
    { teamMemberId: text(formData, "teamMemberId"), role: role(formData) },
    await dependencies(),
  );
  back(outcome, "role");
}

export async function resetPasswordAction(formData: FormData): Promise<void> {
  const outcome = await resetPassword(
    { teamMemberId: text(formData, "teamMemberId"), password: text(formData, "password") },
    await dependencies(),
  );
  back(outcome, "password");
}

export async function deactivateAccountAction(formData: FormData): Promise<void> {
  const outcome = await deactivateAccount({ teamMemberId: text(formData, "teamMemberId") }, await dependencies());
  back(outcome, "deactivated");
}
