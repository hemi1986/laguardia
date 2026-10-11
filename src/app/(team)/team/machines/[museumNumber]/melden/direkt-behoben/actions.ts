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
import { reportAndResolveFields, reportAndResolveInput, type ReportAndResolveField } from "./report-and-resolve-input";

/** After a rejection: the error, the typed values, and whether the photo must be chosen again (G8a). */
export type ReportAndResolveState =
  | (NonNullable<FormState<CommandError<typeof reportProblemAndTriageCommand> | PhotoError, ReportAndResolveField>> & {
      photoAgain?: boolean;
    })
  | null;

/**
 * CMD-ReportProblem with the triage outcome *resolved on the spot* in the same step (ST-052) – through the Server
 * Action runner, as the signed-in team member, helper or technician; everything is sent once and stored together.
 * Afterwards the team member is back on the machine record, which confirms it (G3). The page binds the museum number;
 * the server finds the machine by it, and the command checks that machine again.
 */
export async function reportAndResolveAction(
  museumNumber: string,
  previous: ReportAndResolveState,
  formData: FormData,
): Promise<ReportAndResolveState> {
  await requireTeamMember(); // the page's access check; who may resolve on the spot when reporting is the command's
  const record = `/team/machines/${encodeURIComponent(museumNumber)}`;
  const machine = await machineForTeamForm(database(), museumNumber);
  const state = await photoFormAction(reportProblemAndTriageCommand, {
    fields: reportAndResolveFields,
    photo: reportAndTriagePhoto,
    input: (fields, photo) => reportAndResolveInput(fields, machine?.id, photo),
    onSuccess: async ({ problemReportId }) => {
      revalidatePath(record);
      redirect(`${record}?resolvedOnTheSpot=${problemReportId}`);
    },
  })(previous, formData);
  return withPhotoToChooseAgain(state, formData);
}
