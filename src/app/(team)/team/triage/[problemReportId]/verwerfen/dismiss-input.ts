import { reasonsByHand, type DismissProblemReportInput } from "@/modules/repair";
import type { FormFields } from "@/app/_actions/form-action";
import { versionSeen } from "@/app/_actions/version";

/** The form's own fields – only these are read and echoed after a rejection (ST-073). */
export const dismissFields = ["version", "reason", "reasonText"] as const;

export type DismissField = (typeof dismissFields)[number];

/**
 * Reads the form „Meldung verwerfen“ (ST-073, Q19): no validation, no default. A missing or unknown reason is no reason –
 * the command rejects it; a missing free text is an empty one; a version that is not a whole number is one nobody saw –
 * the command layer answers with a conflict.
 */
export function dismissInput(fields: FormFields<DismissField>, problemReportId: string): DismissProblemReportInput {
  return {
    problemReportId,
    version: versionSeen(fields.version),
    reason: reasonsByHand.find((reason) => reason === fields.reason),
    reasonText: fields.reasonText ?? "",
  };
}

/**
 * Where a post of the form stands (ST-020, G10): a spam dismissal asks once before it runs – „Endgültig verwerfen“
 * posts `step=confirm`, „Zurück“ posts `step=back` and returns to the form with spam still chosen. Every other reason
 * runs at once. Server-side, so it works without JavaScript.
 */
export function dismissStep(formData: FormData): "ask" | "back" | "run" {
  const step = formData.get("step");
  if (step === "back") return "back";
  return formData.get("reason") === "spam" && step !== "confirm" ? "ask" : "run";
}

/** What was chosen and typed, kept while the spam question is asked and after „Zurück“. */
export function keptValues(formData: FormData): { readonly [F in DismissField]: string } {
  const value = (name: DismissField) => {
    const posted = formData.get(name);
    return typeof posted === "string" ? posted : "";
  };
  return { version: value("version"), reason: value("reason"), reasonText: value("reasonText") };
}
