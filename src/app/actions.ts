"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { reportProblemCommand } from "@/modules/repair";
import { grantSpikeAccess, hasSpikeAccess } from "@/spike/access";
import { formAction } from "./_actions/form-action";
import { reportProblemFields, reportProblemInput } from "./report-problem-input";

export async function enterSpike(formData: FormData): Promise<void> {
  const ok = await grantSpikeAccess(String(formData.get("password") ?? ""));
  redirect(ok ? "/" : "/?denied=1");
}

const reportProblem = formAction(reportProblemCommand, {
  fields: reportProblemFields,
  input: reportProblemInput,
  onSuccess: async () => {
    revalidatePath("/");
    redirect("/");
  },
});

export type ReportProblemState = Parameters<typeof reportProblem>[0];

/** CMD-ReportProblem for the hard-coded test machine of the ST-001 spike – by the acting person of the request. */
export async function reportProblemForTestMachine(
  previous: ReportProblemState,
  formData: FormData,
): Promise<ReportProblemState> {
  if (!(await hasSpikeAccess())) redirect("/");
  return reportProblem(previous, formData);
}
