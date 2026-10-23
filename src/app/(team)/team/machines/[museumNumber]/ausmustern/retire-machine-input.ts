import type { RetireMachineInput } from "@/modules/collection";
import type { FormFields } from "@/app/_actions/form-action";
import { versionSeen } from "@/app/_actions/version";

/** The form's own fields – only these are read and echoed after a rejection (ST-073). */
export const retireMachineFields = ["machineId", "version", "reason"] as const;

export type RetireMachineField = (typeof retireMachineFields)[number];

/**
 * Reads the retire form (ST-073, Q19): no validation, no default. The reason arrives as it was typed; CMD-RetireMachine
 * rejects an empty one. A version that is not a whole number is one nobody saw.
 */
export function retireMachineInput(fields: FormFields<RetireMachineField>): RetireMachineInput {
  return {
    machineId: fields.machineId ?? "",
    version: versionSeen(fields.version),
    reason: fields.reason ?? "",
  };
}

/**
 * Where a post of the form stands (ST-039, G10b): sending the reason asks once – „Endgültig ausmustern“ posts
 * `step=confirm`, „Zurück“ posts `step=back` and returns to the form with the reason kept. Server-side, so it works
 * without JavaScript.
 */
export function retireStep(formData: FormData): "ask" | "back" | "run" {
  const step = formData.get("step");
  return step === "confirm" ? "run" : step === "back" ? "back" : "ask";
}

/** What was typed, kept while the question is asked and after „Zurück“. */
export function keptValues(formData: FormData): { readonly [F in RetireMachineField]: string } {
  const value = (name: RetireMachineField) => {
    const posted = formData.get(name);
    return typeof posted === "string" ? posted : "";
  };
  return { machineId: value("machineId"), version: value("version"), reason: value("reason") };
}
