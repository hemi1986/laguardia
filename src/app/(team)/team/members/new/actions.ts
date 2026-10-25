"use server";

import { redirect } from "next/navigation";
import { createAccount, type AccountError } from "@/modules/team";
import type { Role } from "@/platform/command";
import { database } from "@/platform/database";
import { currentPerson } from "@/app/_actions/current-person";
import { postedRole } from "../role-field";

/**
 * Creating a team member (ST-005, ST-081). The Team module's `createAccount` is no command, so this action mirrors
 * the runner's contract by hand: a rejection returns why and what was typed – never the password (G8); a success
 * lands on the list, which names the new team member (G3).
 */
export type CreateTeamMemberState = {
  error: AccountError;
  values: { name: string; username: string; role: Role };
} | null;

export async function createTeamMemberAction(
  _previous: CreateTeamMemberState,
  formData: FormData,
): Promise<CreateTeamMemberState> {
  const values = {
    name: String(formData.get("name") ?? ""),
    username: String(formData.get("username") ?? ""),
    role: postedRole(formData),
  };
  const outcome = await createAccount(
    { ...values, password: String(formData.get("password") ?? "") },
    { db: database(), actor: await currentPerson() },
  );
  if (!outcome.ok) return { error: outcome.error, values };
  redirect(`/team/members?created=${outcome.teamMemberId}`);
}
