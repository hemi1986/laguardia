"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { reportProblemCommand } from "@/modules/repair";
import { executeCommand } from "@/platform/command";
import { grantSpikeAccess, hasSpikeAccess } from "@/spike/access";
import { TEST_MACHINE_ID } from "@/spike/test-machine";
import { actingPerson } from "./team-session";

export async function enterSpike(formData: FormData): Promise<void> {
  const ok = await grantSpikeAccess(String(formData.get("password") ?? ""));
  redirect(ok ? "/" : "/?denied=1");
}

/** CMD-ReportProblem for the hard-coded test machine of the ST-001 spike – by the logged-in team member or a visitor. */
export async function reportProblemForTestMachine(formData: FormData): Promise<void> {
  if (!(await hasSpikeAccess())) redirect("/");
  const outcome = await executeCommand(
    reportProblemCommand,
    { machineId: TEST_MACHINE_ID, description: String(formData.get("description") ?? "") },
    { actor: await actingPerson() },
  );
  if (!outcome.ok) redirect(`/?error=${outcome.error}`);
  revalidatePath("/");
  redirect("/");
}
