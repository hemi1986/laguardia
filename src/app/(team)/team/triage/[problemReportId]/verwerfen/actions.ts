"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { dismissProblemReportCommand } from "@/modules/repair";
import { formAction, type FormState } from "@/app/_actions/form-action";
import { systemClock } from "@/platform/clock";
import type { CommandError } from "@/platform/command";
import { database } from "@/platform/database";
import { requireTechnician } from "../../../../../team-session";
import { withWhoTriagedFirst } from "../who-triaged-first";
import { dismissFields, dismissInput, dismissStep, keptValues, type DismissField } from "./dismiss-input";

/** A rejection: the error and what was chosen – and who triaged it first, when that is the reason (ST-020). */
export type DismissRejection = NonNullable<
  FormState<CommandError<typeof dismissProblemReportCommand>, DismissField>
> & { triagedBy?: string; asking?: undefined };

/**
 * The form's state: null before the first post; a rejection; or the spam question – asked (`asking: true`) or gone back
 * from (`asking: false`) – with what was chosen and typed (G10).
 */
export type DismissState =
  | DismissRejection
  | { asking: boolean; error?: undefined; values: { readonly [F in DismissField]: string } }
  | null;

/**
 * CMD-DismissProblemReport from the form „Meldung verwerfen“ (ST-020) – through the Server Action runner (ST-073). A
 * spam dismissal asks once first; it deletes the stored photo after the commit. Afterwards the technician is back on
 * the triage list with a confirmation naming the machine (G3, G21). The page binds the problem report's ID.
 */
export async function dismissAction(
  problemReportId: string,
  previous: DismissState,
  formData: FormData,
): Promise<DismissState> {
  await requireTechnician(); // the page's access check; who may dismiss is the command's allowedActors
  const step = dismissStep(formData);
  if (step !== "run") return { asking: step === "ask", values: keptValues(formData) };
  const state = await formAction(dismissProblemReportCommand, {
    fields: dismissFields,
    input: (fields) => dismissInput(fields, problemReportId),
    removesPhoto: ({ removedPhoto }) => removedPhoto,
    onSuccess: async () => {
      revalidatePath("/team/triage");
      redirect(`/team/triage?dismissed=${problemReportId}`);
    },
  })(null, formData);
  // Name who triaged it first – "Tom hat diese Meldung schon gesichtet." (story review 2026-10-03)
  return withWhoTriagedFirst(database(), systemClock, problemReportId, state);
}
