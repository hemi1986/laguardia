"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { logIn } from "@/modules/team";
import { database } from "@/platform/database";

export async function logInAction(formData: FormData): Promise<void> {
  const outcome = await logIn(
    { username: String(formData.get("username") ?? ""), password: String(formData.get("password") ?? "") },
    { db: database(), headers: await headers(), inNext: true },
  );
  redirect(outcome.ok ? "/team" : `/login?error=${outcome.error}`);
}
