"use server";

import { defectFormAction, type DefectActionState } from "../defect-action";
import { resolveDefectFields, resolveDefectInput, type ResolveDefectField } from "./resolve-defect-input";

export type ResolveDefectState = DefectActionState<"resolve", ResolveDefectField>;

/**
 * CMD-ResolveDefect from the form „Defekt beheben“ (ST-028) – the defect's page then confirms it and shows how the defect
 * ended (G3); who may resolve which defect is the command's.
 */
export async function resolveDefectAction(defectId: string, previous: ResolveDefectState, formData: FormData) {
  return defectFormAction("resolve", {
    fields: resolveDefectFields,
    input: (fields) => resolveDefectInput(fields, defectId),
  })(previous, formData);
}
