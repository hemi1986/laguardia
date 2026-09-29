"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { changeOwnPassword } from "@/modules/team";
import { database } from "@/platform/database";
import { actingPerson } from "../../../team-session";

/** A team member changes their own password, proving the current one (ST-005). */
export async function changeOwnPasswordAction(formData: FormData): Promise<void> {
  const outcome = await changeOwnPassword(
    {
      currentPassword: String(formData.get("currentPassword") ?? ""),
      newPassword: String(formData.get("newPassword") ?? ""),
    },
    { db: database(), actor: await actingPerson(), headers: await headers(), inNext: true },
  );
  redirect(outcome.ok ? "/team/password?done=changed" : `/team/password?error=${outcome.error}`);
}
