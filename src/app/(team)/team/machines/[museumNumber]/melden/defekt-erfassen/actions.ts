"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { machineForTeamForm } from "@/modules/collection";
import { reportProblemAndTriageCommand } from "@/modules/repair";
import { photoFormAction, type FormState } from "@/app/_actions/form-action";
import type { PhotoError } from "@/photo";
import type { CommandError } from "@/platform/command";
import { database } from "@/platform/database";
import { requireTechnician } from "../../../../../../team-session";
import {
  reportAndRecordDefectFields,
  reportAndRecordDefectInput,
  reportAndRecordDefectPhoto,
  withPhotoToChooseAgain,
  type ReportAndRecordDefectField,
} from "./report-and-record-defect-input";

/** After a rejection: the error, the typed values, and whether the photo must be chosen again (G8a). */
export type ReportAndRecordDefectState =
  | (NonNullable<
      FormState<CommandError<typeof reportProblemAndTriageCommand> | PhotoError, ReportAndRecordDefectField>
    > & { photoAgain?: boolean })
  | null;

/**
 * CMD-ReportProblem with the triage outcome *record a defect* in the same step (ST-023) – through the Server Action
 * runner, as the signed-in technician; everything is sent once and stored together. Afterwards the technician is back
 * on the machine record, which confirms the defect and – when it changed – the machine's new status (G3). The page
 * binds the museum number; the server finds the machine by it, and the command checks that machine again.
 */
export async function reportAndRecordDefectAction(
  museumNumber: string,
  previous: ReportAndRecordDefectState,
  formData: FormData,
): Promise<ReportAndRecordDefectState> {
  await requireTechnician(); // the page's access check; who may record a defect when reporting is the command's
  const record = `/team/machines/${encodeURIComponent(museumNumber)}`;
  const machine = await machineForTeamForm(database(), museumNumber);
  const statusChanged = Boolean(formData.get("machineStatus"));
  const state = await photoFormAction(reportProblemAndTriageCommand, {
    fields: reportAndRecordDefectFields,
    photo: reportAndRecordDefectPhoto,
    input: (fields, photo) => reportAndRecordDefectInput(fields, machine?.id, photo),
    onSuccess: async ({ defectId }) => {
      revalidatePath(record);
      redirect(`${record}?defectRecorded=${defectId ?? ""}${statusChanged ? "&statusChanged=1" : ""}`);
    },
  })(previous, formData);
  return withPhotoToChooseAgain(state, formData);
}
