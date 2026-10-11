"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { machineForTeamForm } from "@/modules/collection";
import { reportProblemAndTriageCommand } from "@/modules/repair";
import { photoFormAction, type FormState } from "@/app/_actions/form-action";
import type { PhotoError } from "@/photo";
import type { CommandError } from "@/platform/command";
import { database } from "@/platform/database";
import { requireTeamMember } from "../../../../../../team-session";
import { reportAndTriagePhoto, withPhotoToChooseAgain } from "../report-and-triage";
import { reportAndLinkFields, reportAndLinkInput, type ReportAndLinkField } from "./report-and-link-input";

/** After a rejection: the error, the typed values, and whether the photo must be chosen again (G8a). */
export type ReportAndLinkState =
  | (NonNullable<FormState<CommandError<typeof reportProblemAndTriageCommand> | PhotoError, ReportAndLinkField>> & {
      photoAgain?: boolean;
    })
  | null;

/**
 * CMD-ReportProblem with the triage outcome *linked* in the same step (ST-052) – through the Server Action runner, as
 * the signed-in technician; everything is sent once and stored together. Afterwards the technician is back on the
 * machine record, which confirms it naming the defect (G3). The page binds the museum number; the server finds the
 * machine by it, and the command checks that machine and the chosen defect again.
 */
export async function reportAndLinkAction(
  museumNumber: string,
  previous: ReportAndLinkState,
  formData: FormData,
): Promise<ReportAndLinkState> {
  // The page's access check. Who may link when reporting is the command's: a helper who sends this form anyway is
  // rejected there, with nothing stored (G11), and the page then leads to the plain report form.
  await requireTeamMember();
  const record = `/team/machines/${encodeURIComponent(museumNumber)}`;
  const machine = await machineForTeamForm(database(), museumNumber);
  const state = await photoFormAction(reportProblemAndTriageCommand, {
    fields: reportAndLinkFields,
    photo: reportAndTriagePhoto,
    input: (fields, photo) => reportAndLinkInput(fields, machine?.id, photo),
    onSuccess: async ({ problemReportId }) => {
      revalidatePath(record);
      redirect(`${record}?linked=${problemReportId}`);
    },
  })(previous, formData);
  return withPhotoToChooseAgain(state, formData);
}
