import type { PhotoError } from "@/photo";
import { teamReportProblemPhoto } from "./report-problem-input";

/**
 * What the forms that report and triage in the same step share (ST-023, ST-052) – „… und Defekt erfassen“, „… und mit
 * Defekt verknüpfen“, „… und als direkt behoben eintragen“: the problem report's photo and what a rejection says
 * about it.
 */

/** The optional photo of the problem report – the same as on the team's report form (ST-016). */
export const reportAndTriagePhoto = teamReportProblemPhoto;

/**
 * The rejections of the photo itself (ST-016): their texts already say to choose another photo or leave it out. A photo
 * that could not be stored (`not-stored`) is not one of them – the photo was fine, and "try again" needs it again.
 */
const photoRejections: readonly PhotoError[] = ["too-large", "not-an-image", "unsupported-format"];

/**
 * Marks a rejection after which the photo must be chosen again (G8a): the form had a photo attached, and the browser
 * cannot put it back. Not after a rejection of the photo itself (user, 2026-10-10). `formData` is the post the
 * rejection answers.
 */
export function withPhotoToChooseAgain<State extends { error: string }>(
  state: State | null,
  formData: FormData,
): (State & { photoAgain: boolean }) | null {
  if (!state) return null;
  const photo = formData.get(teamReportProblemPhoto.field);
  const attached = photo instanceof Blob && photo.size > 0;
  return { ...state, photoAgain: attached && !(photoRejections as readonly string[]).includes(state.error) };
}
