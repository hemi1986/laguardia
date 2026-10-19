"use server";

import { defectFormAction, type DefectActionState } from "../defect-action";
import { assignDefectFields, assignDefectInput, type AssignDefectField } from "./assign-defect-input";

export type AssignDefectState = DefectActionState<"assign", AssignDefectField>;

/**
 * CMD-ClaimDefect for someone else, from the form „Defekt zuweisen“ (ST-026) – the defect's page then confirms the
 * assignment (G3); that only technicians assign, and to whom, is the command's.
 */
export async function assignDefectAction(defectId: string, previous: AssignDefectState, formData: FormData) {
  return defectFormAction("assign", {
    fields: assignDefectFields,
    input: (fields) => assignDefectInput(fields, defectId),
  })(previous, formData);
}
