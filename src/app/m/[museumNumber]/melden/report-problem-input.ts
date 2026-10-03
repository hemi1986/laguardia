import type { FormFields } from "@/app/_actions/form-action";

/**
 * The report form's only field (ST-013) – read and echoed after a rejection (ST-073). Nothing about the visitor: no
 * name, no e-mail address, no other contact data; and no machine ID – the server finds the machine by its museum
 * number, so nothing internal reaches the public page.
 */
export const reportProblemFields = ["description"] as const;

export type ReportProblemField = (typeof reportProblemFields)[number];

/**
 * Reads the report form (Q19): no validation, no default – the description arrives as it was typed. An unknown machine
 * is "no machine" (an empty ID), which CMD-ReportProblem rejects as not found.
 */
export function reportProblemInput(fields: FormFields<ReportProblemField>, machineId: string | undefined) {
  return { machineId: machineId ?? "", description: fields.description ?? "" };
}
