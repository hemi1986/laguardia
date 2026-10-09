"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { linkProblemReportToDefectCommand } from "@/modules/repair";
import { formAction, type FormState } from "@/app/_actions/form-action";
import { systemClock } from "@/platform/clock";
import type { CommandError } from "@/platform/command";
import { database } from "@/platform/database";
import { requireTechnician } from "../../../../../team-session";
import { withWhoTriagedFirst } from "../who-triaged-first";
import { linkToDefectFields, linkToDefectInput, type LinkToDefectField } from "./link-to-defect-input";

/** After a rejection: the error and the chosen defect – and who triaged it first, when that is the reason (ST-022). */
export type LinkToDefectState =
  | (NonNullable<FormState<CommandError<typeof linkProblemReportToDefectCommand>, LinkToDefectField>> & {
      triagedBy?: string;
    })
  | null;

/**
 * CMD-LinkProblemReportToDefect from the form „Mit Defekt verknüpfen“ (ST-022) – through the Server Action runner
 * (ST-073). Afterwards the technician is back on the triage list with a confirmation naming the machine and the defect
 * (G3, G21). The page binds the problem report's ID.
 */
export async function linkToDefectAction(
  problemReportId: string,
  previous: LinkToDefectState,
  formData: FormData,
): Promise<LinkToDefectState> {
  await requireTechnician(); // the page's access check; who may link is the command's allowedActors
  const state = await formAction(linkProblemReportToDefectCommand, {
    fields: linkToDefectFields,
    input: (fields) => linkToDefectInput(fields, problemReportId),
    onSuccess: async () => {
      revalidatePath("/team/triage");
      revalidatePath("/team/defects");
      redirect(`/team/triage?linked=${problemReportId}`);
    },
  })(previous, formData);
  // Name who triaged it first – "Tom hat diese Meldung schon gesichtet." (story review 2026-10-03)
  return withWhoTriagedFirst(database(), systemClock, problemReportId, state);
}
