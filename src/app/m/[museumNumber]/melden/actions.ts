"use server";

import { redirect } from "next/navigation";
import { machineIdOf } from "@/modules/collection";
import { reportProblemCommand } from "@/modules/repair";
import { photoFormAction, type FormState } from "@/app/_actions/form-action";
import type { PhotoError } from "@/photo";
import type { CommandError } from "@/platform/command";
import { database } from "@/platform/database";
import {
  reportProblemFields,
  reportProblemInput,
  reportProblemPhoto,
  type ReportProblemField,
} from "./report-problem-input";

export type ReportProblemState = FormState<CommandError<typeof reportProblemCommand> | PhotoError, ReportProblemField>;

/**
 * CMD-ReportProblem from the report form page (ST-013) – through the Server Action runner (ST-073), as whoever the
 * session says (a visitor without one). After the problem report the visitor is back on the visitor machine page,
 * which confirms it (G3). The page binds the museum number; the server finds the machine by it, so the problem report
 * and the confirmation are always about the same machine, and the redirect stays under `/m/` whatever it holds.
 */
export async function reportProblemAction(
  museumNumber: string,
  previous: ReportProblemState,
  formData: FormData,
): Promise<ReportProblemState> {
  const machineId = await machineIdOf(database(), museumNumber);
  return photoFormAction(reportProblemCommand, {
    fields: reportProblemFields,
    photo: reportProblemPhoto,
    input: (fields, photo) => reportProblemInput(fields, machineId, photo),
    onSuccess: async () => redirect(`/m/${encodeURIComponent(museumNumber)}?gemeldet=1`),
  })(previous, formData);
}
