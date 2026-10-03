"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { machineForTeamForm } from "@/modules/collection";
import { reportProblemCommand } from "@/modules/repair";
import { formAction, type FormState } from "@/app/_actions/form-action";
import type { CommandError } from "@/platform/command";
import { database } from "@/platform/database";
import { requireTeamMember } from "../../../../../team-session";
import {
  teamReportProblemFields,
  teamReportProblemInput,
  type TeamReportProblemField,
} from "./report-problem-input";

export type TeamReportProblemState = FormState<CommandError<typeof reportProblemCommand>, TeamReportProblemField>;

/**
 * CMD-ReportProblem from the machine record (ST-015) – through the Server Action runner (ST-073), as the signed-in
 * team member. Afterwards the team member is back on the machine record, which confirms it (G3). The page binds the
 * museum number; the server finds the machine by it – one source for the problem report and the confirmation – and the
 * command checks that machine again (retired included).
 */
export async function teamReportProblemAction(
  museumNumber: string,
  previous: TeamReportProblemState,
  formData: FormData,
): Promise<TeamReportProblemState> {
  await requireTeamMember(); // the page's access check; who may report for which machine is the command's
  const record = `/team/machines/${encodeURIComponent(museumNumber)}`;
  const machine = await machineForTeamForm(database(), museumNumber);
  return formAction(reportProblemCommand, {
    fields: teamReportProblemFields,
    input: (fields) => teamReportProblemInput(fields, machine?.id),
    onSuccess: async () => {
      revalidatePath(record);
      redirect(`${record}?problemReported=1`);
    },
  })(previous, formData);
}
