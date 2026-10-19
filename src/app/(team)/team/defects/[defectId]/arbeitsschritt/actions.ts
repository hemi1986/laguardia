"use server";

import { defectFormAction, type DefectActionState } from "../defect-action";
import { logWorkFields, logWorkInput, type LogWorkField } from "./log-work-input";

export type LogWorkState = DefectActionState<"log-work", LogWorkField>;

/**
 * CMD-LogWork from the form „Arbeitsschritt eintragen“ (ST-024) – the defect's page then confirms it and shows the entry at
 * the top of the work log (G3).
 */
export async function logWorkAction(defectId: string, previous: LogWorkState, formData: FormData) {
  return defectFormAction("log-work", {
    fields: logWorkFields,
    input: (fields) => logWorkInput(fields, defectId),
  })(previous, formData);
}
