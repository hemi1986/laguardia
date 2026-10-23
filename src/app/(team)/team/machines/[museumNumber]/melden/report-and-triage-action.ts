import "server-only";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { machineForTeamForm } from "@/modules/collection";
import { reportProblemAndTriageCommand, type ReportProblemAndTriageInput } from "@/modules/repair";
import { formAction, type FormFields, type PhotoFormState } from "@/app/_actions/form-action";
import type { PhotoError } from "@/photo";
import type { CommandError } from "@/platform/command";
import { database } from "@/platform/database";
import { requireTeamMember } from "../../../../../team-session";
import { teamReportProblemPhoto } from "./report-problem-input";

/** After a rejection: the error, the typed values, and whether the photo must be chosen again (G8a). */
export type ReportAndTriageState<Field extends string> = PhotoFormState<
  CommandError<typeof reportProblemAndTriageCommand> | PhotoError,
  Field
>;

type Reported = { problemReportId: string; defectId?: string };

/**
 * What the Server Actions of the forms that report and triage in the same step share (ST-023, ST-052):
 * CMD-ReportProblem with its triage outcome through the Server Action runner, as the signed-in team member, with the
 * problem report's photo – everything is sent once and stored together. The page binds the museum number; the server
 * finds the machine by it, and the command checks that machine again. Afterwards the team member is back on the machine
 * record, whose address carries what it confirms (G3); a rejection says whether the photo must be chosen again (G8a).
 *
 * The access check is only "a team member": who may choose which triage outcome is the command's – a helper who sends
 * a technician's form anyway is rejected there, with nothing stored (G11).
 */
export async function reportAndTriage<const Field extends string>(
  museumNumber: string,
  previous: ReportAndTriageState<Field>,
  formData: FormData,
  form: {
    fields: readonly Field[];
    /** Reads the form's fields (Q19) – the machine is the one found by the museum number, none for an unknown one. */
    input: (fields: FormFields<Field>, machineId: string | undefined, photo?: string) => ReportProblemAndTriageInput;
    /** The machine record's query that names what was stored, e.g. `linked=<problem report ID>`. */
    confirms: (reported: Reported) => string;
  },
): Promise<ReportAndTriageState<Field>> {
  await requireTeamMember();
  const record = `/team/machines/${encodeURIComponent(museumNumber)}`;
  const machine = await machineForTeamForm(database(), museumNumber);
  return formAction(reportProblemAndTriageCommand, {
    fields: form.fields,
    photo: teamReportProblemPhoto,
    input: (fields, photo) => form.input(fields, machine?.id, photo),
    onSuccess: async (reported) => {
      revalidatePath(record);
      redirect(`${record}?${form.confirms(reported)}`);
    },
  })(previous, formData);
}
