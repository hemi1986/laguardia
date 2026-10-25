"use server";

import { defectPhotosFormAction, type DefectPhotosActionState } from "../defect-action";
import { logWorkFields, logWorkInput, logWorkPhotos, type LogWorkField } from "./log-work-input";

export type LogWorkState = DefectPhotosActionState<"log-work", LogWorkField>;

/**
 * CMD-LogWork from the form „Arbeitsschritt eintragen“ (ST-024), with its photos (ST-032) – the defect's page then
 * confirms it and shows the entry at the top of the work log (G3).
 */
export async function logWorkAction(defectId: string, previous: LogWorkState, formData: FormData) {
  return defectPhotosFormAction("log-work", {
    fields: logWorkFields,
    photos: logWorkPhotos,
    input: (fields, photos) => logWorkInput(fields, defectId, photos),
  })(previous, formData);
}
