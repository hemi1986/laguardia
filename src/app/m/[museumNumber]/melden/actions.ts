"use server";

import { redirect } from "next/navigation";
import { reportProblemCommand } from "@/modules/repair";
import { formAction, type FormState } from "@/app/_actions/form-action";
import type { CommandError } from "@/platform/command";
import { reportProblemFields, reportProblemInput, type ReportProblemField } from "./report-problem-input";

export type ReportProblemState = FormState<CommandError<typeof reportProblemCommand>, ReportProblemField>;

/**
 * CMD-ReportProblem from the report form page (ST-013) – through the Server Action runner (ST-073), as whoever the
 * session says (a visitor without one). After the problem report the visitor is back on the visitor machine page,
 * which confirms it (G3). The page binds the museum number; the redirect stays under `/m/` whatever it holds.
 */
export async function reportProblemAction(
  museumNumber: string,
  previous: ReportProblemState,
  formData: FormData,
): Promise<ReportProblemState> {
  return formAction(reportProblemCommand, {
    fields: reportProblemFields,
    input: reportProblemInput,
    onSuccess: async () => redirect(`/m/${encodeURIComponent(museumNumber)}?gemeldet=1`),
  })(previous, formData);
}
