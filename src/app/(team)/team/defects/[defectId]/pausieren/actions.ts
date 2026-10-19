"use server";

import { defectFormAction, type DefectActionState } from "../defect-action";
import { putDefectOnHoldFields, putDefectOnHoldInput, type PutDefectOnHoldField } from "./put-defect-on-hold-input";

export type PutDefectOnHoldState = DefectActionState<"put-on-hold", PutDefectOnHoldField>;

/**
 * CMD-PutDefectOnHold from the form „Defekt pausieren“ (ST-029) – the defect's page then confirms the hold with its reason
 * (G3); who may put which defect on hold is the command's.
 */
export async function putDefectOnHoldAction(defectId: string, previous: PutDefectOnHoldState, formData: FormData) {
  return defectFormAction("put-on-hold", {
    fields: putDefectOnHoldFields,
    input: (fields) => putDefectOnHoldInput(fields, defectId),
  })(previous, formData);
}
