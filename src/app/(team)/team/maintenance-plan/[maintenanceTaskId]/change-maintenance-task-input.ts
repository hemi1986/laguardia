import type { ChangeMaintenancePlanInput } from "@/modules/maintenance";
import type { FormFields } from "@/app/_actions/form-action";
import { versionSeen } from "@/app/_actions/version";
import { maintenanceTaskChangesOf, maintenanceTaskFields } from "../maintenance-task-input";

/** The form's own fields – only these are read and echoed after a rejection (ST-073). */
export const changeMaintenanceTaskFields = ["version", "maintenanceTaskId", ...maintenanceTaskFields] as const;

export type ChangeMaintenanceTaskField = (typeof changeMaintenanceTaskFields)[number];

/** What removing reads – the maintenance task and the version of the plan the page showed. */
export const removeMaintenanceTaskFields = ["version", "maintenanceTaskId"] as const;

/** Reads the change form (ST-041, Q19): the maintenance task, and the details every maintenance task has. */
export function changeMaintenanceTaskInput(fields: FormFields<ChangeMaintenanceTaskField>): ChangeMaintenancePlanInput {
  return {
    version: versionSeen(fields.version),
    change: "change",
    maintenanceTaskId: fields.maintenanceTaskId ?? "",
    task: maintenanceTaskChangesOf(fields),
  };
}

/** Reads „Endgültig entfernen“ on the question (ST-041): which maintenance task, at the version the page showed. */
export function removeMaintenanceTaskInput(
  fields: FormFields<(typeof removeMaintenanceTaskFields)[number]>,
): ChangeMaintenancePlanInput {
  return { version: versionSeen(fields.version), change: "remove", maintenanceTaskId: fields.maintenanceTaskId ?? "" };
}

/**
 * Where a post of the form stands (ST-041, G10b): „Wartungsaufgabe ändern“ changes; „Wartungsaufgabe entfernen“ posts
 * `step=ask` and only asks; on the question „Endgültig entfernen“ posts `step=remove`, „Zurück“ `step=back`, which returns to the
 * form with everything typed. Server-side, so it works without JavaScript.
 */
export function changeStep(formData: FormData): "change" | "ask" | "back" | "remove" {
  const step = formData.get("step");
  return step === "ask" || step === "back" || step === "remove" ? step : "change";
}

/** What was typed, kept while the question is asked and after „Zurück“ – an unticked checkbox is "". */
export function keptValues(formData: FormData): { readonly [F in ChangeMaintenanceTaskField]: string } {
  const value = (name: ChangeMaintenanceTaskField) => {
    const posted = formData.get(name);
    return typeof posted === "string" ? posted : "";
  };
  return Object.fromEntries(changeMaintenanceTaskFields.map((name) => [name, value(name)])) as {
    readonly [F in ChangeMaintenanceTaskField]: string;
  };
}
