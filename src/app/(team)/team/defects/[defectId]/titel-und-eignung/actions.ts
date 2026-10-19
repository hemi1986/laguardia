"use server";

import { defectFormAction, type DefectActionState } from "../defect-action";
import {
  changeDefectDetailsFields,
  changeDefectDetailsInput,
  type ChangeDefectDetailsField,
} from "./change-defect-details-input";

export type ChangeDefectDetailsState = DefectActionState<"change-details", ChangeDefectDetailsField>;

/**
 * CMD-ChangeDefectDetails from the form „Titel und Eignung ändern“ (ST-031) – the defect's page then confirms each change
 * and a released claim (G3); that only technicians change it, and only an open defect, is the command's.
 */
export async function changeDefectDetailsAction(
  defectId: string,
  previous: ChangeDefectDetailsState,
  formData: FormData,
) {
  return defectFormAction("change-details", {
    fields: changeDefectDetailsFields,
    input: (fields) => changeDefectDetailsInput(fields, defectId),
  })(previous, formData);
}
