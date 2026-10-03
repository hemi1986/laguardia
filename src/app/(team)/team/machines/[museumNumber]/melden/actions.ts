"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { reportProblemCommand } from "@/modules/repair";
import { formAction, type FormState } from "@/app/_actions/form-action";
import type { CommandError } from "@/platform/command";
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
 * museum number for where to go next; the machine itself comes from the posted ID, which the command checks again.
 */
export async function teamReportProblemAction(
  museumNumber: string,
  previous: TeamReportProblemState,
  formData: FormData,
): Promise<TeamReportProblemState> {
  await requireTeamMember(); // the page's access check; who may report for which machine is the command's
  const record = `/team/machines/${encodeURIComponent(museumNumber)}`;
  return formAction(reportProblemCommand, {
    fields: teamReportProblemFields,
    input: teamReportProblemInput,
    onSuccess: async () => {
      revalidatePath(record);
      redirect(`${record}?gemeldet=1`);
    },
  })(previous, formData);
}
