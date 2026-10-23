"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { machineForTeamForm } from "@/modules/collection";
import { reportProblemCommand } from "@/modules/repair";
import { formAction, type PhotoFormState } from "@/app/_actions/form-action";
import type { PhotoError } from "@/photo";
import type { CommandError } from "@/platform/command";
import { database } from "@/platform/database";
import { requireTeamMember } from "../../../../../team-session";
import {
  teamReportProblemFields,
  teamReportProblemInput,
  teamReportProblemPhoto,
  type TeamReportProblemField,
} from "./report-problem-input";

export type TeamReportProblemState = PhotoFormState<
  CommandError<typeof reportProblemCommand> | PhotoError,
  TeamReportProblemField
>;

/**
 * CMD-ReportProblem from the machine record (ST-015) – through the Server Action runner (ST-073), as the signed-in
 * team member. Afterwards the team member is back on the machine record, which confirms it (G3). The page binds the
 * museum number; the server finds the machine by it – one source for the problem report and the confirmation – and the
 * command checks that machine again (retired included). A technician's problem report without a triage outcome is
 * rejected by the command (ST-023) and leads to the choice page.
 */
export async function teamReportProblemAction(
  museumNumber: string,
  previous: TeamReportProblemState,
  formData: FormData,
): Promise<TeamReportProblemState> {
  const member = await requireTeamMember(); // the page's access check; who may report for which machine is the command's
  const record = `/team/machines/${encodeURIComponent(museumNumber)}`;
  const machine = await machineForTeamForm(database(), museumNumber);
  const state = await formAction(reportProblemCommand, {
    fields: teamReportProblemFields,
    photo: teamReportProblemPhoto,
    input: (fields, photo) => teamReportProblemInput(fields, machine?.id, photo),
    onSuccess: async () => {
      revalidatePath(record);
      redirect(`${record}?problemReported=1`);
    },
  })(previous, formData);
  // Only a page loaded before can send this form as a technician (ST-023), and the command stores nothing of it –
  // with a description for want of a triage outcome, without one for want of the description. Either way the page
  // is the choice page now, which asks for the triage outcome; the description typed on the stale page is not kept
  // (user, 2026-10-10).
  if (state && member.role === "technician") redirect(`${record}/melden?triageRequired=1`);
  return state;
}
