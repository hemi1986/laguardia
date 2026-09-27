"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { logOut } from "@/modules/team";
import { database } from "@/platform/database";

export async function logOutAction(): Promise<void> {
  await logOut({ db: database(), headers: await headers(), inNext: true });
  redirect("/login");
}
