import type { ReportProblemAndTriageInput } from "@/modules/repair";
import type { FormFields } from "@/app/_actions/form-action";
import { photoErrors } from "@/photo";
import { recordDefectInput } from "../../../../triage/[problemReportId]/defekt-erfassen/record-defect-input";
import { teamReportProblemPhoto } from "../report-problem-input";

/**
 * The fields of the form „Problem melden und Defekt erfassen“ (ST-023): the problem report's description and the
 * defect's fields as on ST-018's form – only these are read and echoed after a rejection (ST-073).
 */
export const reportAndRecordDefectFields = [
  "description",
  "title",
  "priority",
  "suitableForHelpers",
  "machineStatus",
  "machineVersion",
] as const;

export type ReportAndRecordDefectField = (typeof reportAndRecordDefectFields)[number];

/** The optional photo of the problem report – the same as on the team's report form (ST-016). */
export const reportAndRecordDefectPhoto = teamReportProblemPhoto;

/**
 * Reads the form (Q19): no validation, no default. The description arrives as it was typed; the defect's fields are
 * read exactly as on the form „Defekt erfassen“ (ST-018). The machine is the one the server found by the page's museum
 * number; an unknown one is "no machine", which CMD-ReportProblem rejects.
 */
export function reportAndRecordDefectInput(
  fields: FormFields<ReportAndRecordDefectField>,
  machineId: string | undefined,
  photo?: string,
): ReportProblemAndTriageInput {
  const { title, priority, suitableForHelpers, machineStatus, machineVersion } = recordDefectInput(
    { ...fields, version: undefined },
    "",
  );
  return {
    machineId: machineId ?? "",
    description: fields.description ?? "",
    photo,
    triage: { outcome: "defect-recorded", title, priority, suitableForHelpers, machineStatus, machineVersion },
  };
}

/**
 * Marks a rejection after which the photo must be chosen again (G8a): the form had a photo attached, and the browser
 * cannot put it back. Not after a rejection of the photo itself – ST-016's texts already say what to do with it
 * (user, 2026-10-10). `formData` is the post the rejection answers.
 */
export function withPhotoToChooseAgain<State extends { error: string }>(
  state: State | null,
  formData: FormData,
): (State & { photoAgain: boolean }) | null {
  if (!state) return null;
  const photo = formData.get(reportAndRecordDefectPhoto.field);
  const attached = photo instanceof Blob && photo.size > 0;
  return { ...state, photoAgain: attached && !(photoErrors as readonly string[]).includes(state.error) };
}
