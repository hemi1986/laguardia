"use server";

import type { FormFields } from "@/app/_actions/form-action";
import { defectFormAction, type DefectActionState } from "./defect-action";
import { defectVersionFields, defectVersionInput, type DefectVersionField } from "./defect-version-input";

export type ClaimDefectState = DefectActionState<"claim", DefectVersionField>;
export type ReleaseClaimState = DefectActionState<"release", DefectVersionField>;
export type ResumeDefectState = DefectActionState<"resume", DefectVersionField>;

/** CMD-ClaimDefect from the defect's page (ST-025); who may claim which defect is the command's. */
export async function claimDefectAction(defectId: string, previous: ClaimDefectState, formData: FormData) {
  return defectFormAction("claim", oneTap(defectId))(previous, formData);
}

/**
 * CMD-ReleaseClaim from the defect's page (ST-026) – one's own claim („Abgeben“) or, for a technician, someone else's
 * („Übernahme von Tom aufheben“); whose claim may be released by whom is the command's.
 */
export async function releaseClaimAction(defectId: string, previous: ReleaseClaimState, formData: FormData) {
  return defectFormAction("release", oneTap(defectId))(previous, formData);
}

/** CMD-ResumeDefect from the defect's page (ST-029) – one tap („Fortsetzen“); who may resume which defect is the command's. */
export async function resumeDefectAction(defectId: string, previous: ResumeDefectState, formData: FormData) {
  return defectFormAction("resume", oneTap(defectId))(previous, formData);
}

/** A one-tap action posts only the version its page showed (HS-16); the page binds the defect's ID. */
function oneTap(defectId: string) {
  return {
    fields: defectVersionFields,
    input: (fields: FormFields<DefectVersionField>) => defectVersionInput(fields, defectId),
  };
}
