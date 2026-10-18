"use server";

import { defectFormAction, type DefectActionState } from "../defect-action";
import { prioritizeDefectFields, prioritizeDefectInput, type PrioritizeDefectField } from "./prioritize-defect-input";

export type PrioritizeDefectState = DefectActionState<"prioritize", PrioritizeDefectField>;

/**
 * CMD-PrioritizeDefect from the form „Priorität ändern“ (ST-027) – the defect's page then confirms the new priority (G3);
 * that only technicians prioritize, and only an open defect, is the command's.
 */
export async function prioritizeDefectAction(defectId: string, previous: PrioritizeDefectState, formData: FormData) {
  return defectFormAction("prioritize", {
    fields: prioritizeDefectFields,
    input: (fields) => prioritizeDefectInput(fields, defectId),
  })(previous, formData);
}
