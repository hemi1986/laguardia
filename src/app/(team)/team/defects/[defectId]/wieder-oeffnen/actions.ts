"use server";

import { defectFormAction, type DefectActionState } from "../defect-action";
import { reopenDefectFields, reopenDefectInput, type ReopenDefectField } from "./reopen-defect-input";

export type ReopenDefectState = DefectActionState<"reopen", ReopenDefectField>;

/**
 * CMD-ReopenDefect from the form „Defekt wieder öffnen“ (ST-030) – the defect's page then confirms the reopening, and the
 * machine's new status when one was chosen (as in ST-018). Who may reopen, and who may change the status, is the command's.
 */
export async function reopenDefectAction(defectId: string, previous: ReopenDefectState, formData: FormData) {
  return defectFormAction("reopen", {
    fields: reopenDefectFields,
    input: (fields) => reopenDefectInput(fields, defectId),
  })(previous, formData);
}
