"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordDefectCommand } from "@/modules/repair";
import { formAction, type FormState } from "@/app/_actions/form-action";
import { systemClock } from "@/platform/clock";
import type { CommandError } from "@/platform/command";
import { database } from "@/platform/database";
import { requireTechnician } from "../../../../../team-session";
import { loadProblemReport } from "../problem-report-data";
import { recordDefectFields, recordDefectInput, type RecordDefectField } from "./record-defect-input";

/** After a rejection: the error and the typed values – and who triaged it first, when that is the reason (ST-018). */
export type RecordDefectState =
  | (NonNullable<FormState<CommandError<typeof recordDefectCommand>, RecordDefectField>> & { triagedBy?: string })
  | null;

/**
 * CMD-RecordDefect from the form „Defekt erfassen“ (ST-018) – through the Server Action runner (ST-073). Afterwards the
 * technician is back on the triage list with a confirmation naming the defect, the machine and – when it changed – the
 * machine's new status (G3, G21). The page binds the problem report's ID.
 */
export async function recordDefectAction(
  problemReportId: string,
  previous: RecordDefectState,
  formData: FormData,
): Promise<RecordDefectState> {
  await requireTechnician(); // the page's access check; who may record a defect is the command's allowedActors
  const statusChanged = Boolean(formData.get("machineStatus"));
  const state = await formAction(recordDefectCommand, {
    fields: recordDefectFields,
    input: (fields) => recordDefectInput(fields, problemReportId),
    onSuccess: async ({ defectId }) => {
      revalidatePath("/team/triage");
      redirect(`/team/triage?defectRecorded=${defectId}${statusChanged ? "&statusChanged=1" : ""}`);
    },
  })(previous, formData);
  if (state?.error !== "already-triaged") return state;
  // Name who triaged it first – "Tom hat diese Meldung schon gesichtet." (story review 2026-10-03)
  const report = await loadProblemReport(database(), systemClock, problemReportId);
  return { ...state, triagedBy: report?.triagedBy };
}
