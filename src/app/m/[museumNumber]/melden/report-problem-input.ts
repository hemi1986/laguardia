import type { FormFields } from "@/app/_actions/form-action";

/**
 * The report form's own fields (ST-013) – only these are read and echoed after a rejection (ST-073). Nothing about the
 * visitor: no name, no e-mail address, no other contact data.
 */
export const reportProblemFields = ["machineId", "description"] as const;

export type ReportProblemField = (typeof reportProblemFields)[number];

/** Reads the fields of the report form (Q19): no validation, no default – the description arrives as it was typed. */
export function reportProblemInput(fields: FormFields<ReportProblemField>) {
  return { machineId: fields.machineId ?? "", description: fields.description ?? "" };
}
