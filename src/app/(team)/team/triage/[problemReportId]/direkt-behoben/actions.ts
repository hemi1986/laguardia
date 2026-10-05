"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { resolveProblemOnTheSpotCommand } from "@/modules/repair";
import { formAction, type FormState } from "@/app/_actions/form-action";
import { systemClock } from "@/platform/clock";
import type { CommandError } from "@/platform/command";
import { database } from "@/platform/database";
import { requireTeamMember } from "../../../../../team-session";
import { withWhoTriagedFirst } from "../who-triaged-first";
import { resolveOnTheSpotFields, resolveOnTheSpotInput, type ResolveOnTheSpotField } from "./resolve-on-the-spot-input";

/** After a rejection: the error and the typed note – and who triaged it first, when that is the reason (ST-019). */
export type ResolveOnTheSpotState =
  | (NonNullable<FormState<CommandError<typeof resolveProblemOnTheSpotCommand>, ResolveOnTheSpotField>> & {
      triagedBy?: string;
    })
  | null;

/**
 * CMD-ResolveProblemOnTheSpot from the form „Direkt behoben“ (ST-019) – through the Server Action runner (ST-073).
 * Helpers and technicians alike; afterwards back on the triage list with a confirmation naming the machine (G3, G21).
 * The page binds the problem report's ID.
 */
export async function resolveOnTheSpotAction(
  problemReportId: string,
  previous: ResolveOnTheSpotState,
  formData: FormData,
): Promise<ResolveOnTheSpotState> {
  await requireTeamMember(); // the page's access check; who may resolve on the spot is the command's allowedActors
  const state = await formAction(resolveProblemOnTheSpotCommand, {
    fields: resolveOnTheSpotFields,
    input: (fields) => resolveOnTheSpotInput(fields, problemReportId),
    onSuccess: async () => {
      revalidatePath("/team/triage");
      redirect(`/team/triage?resolvedOnTheSpot=${problemReportId}`);
    },
  })(previous, formData);
  // Name who triaged it first – "Tom hat diese Meldung schon gesichtet." (story review 2026-10-03)
  return withWhoTriagedFirst(database(), systemClock, problemReportId, state);
}
