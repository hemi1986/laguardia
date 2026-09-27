"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { systemClock } from "@/clock";
import { database } from "@/db/client";
import { saveProblemReported } from "@/modules/repair/problem-reports";
import { reportProblem } from "@/modules/repair/report-problem";
import { grantSpikeAccess, hasSpikeAccess } from "@/spike/access";
import { TEST_MACHINE_ID } from "@/spike/test-machine";

export async function enterSpike(formData: FormData): Promise<void> {
  const ok = await grantSpikeAccess(String(formData.get("password") ?? ""));
  redirect(ok ? "/" : "/?denied=1");
}

/** CMD-ReportProblem for the hard-coded test machine of the ST-001 spike. */
export async function reportProblemForTestMachine(formData: FormData): Promise<void> {
  if (!(await hasSpikeAccess())) redirect("/");
  const result = reportProblem(
    {
      machineId: TEST_MACHINE_ID,
      description: String(formData.get("description") ?? ""),
      reporter: { kind: "visitor" },
    },
    { clock: systemClock, newId: randomUUID },
  );
  if (!result.ok) redirect("/?error=description-required");
  await saveProblemReported(database(), result.event);
  revalidatePath("/");
  redirect("/");
}
