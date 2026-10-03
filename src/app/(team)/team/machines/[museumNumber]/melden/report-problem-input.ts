import type { FormFields } from "@/app/_actions/form-action";

/** The team's report form fields (ST-015) – only these are read and echoed after a rejection (ST-073). */
export const teamReportProblemFields = ["machineId", "description"] as const;

export type TeamReportProblemField = (typeof teamReportProblemFields)[number];

/**
 * Reads the team's report form (Q19): no validation, no default – the description arrives as it was typed. A team page
 * may post the machine's ID (engineering conventions); CMD-ReportProblem checks the machine again in its facts.
 */
export function teamReportProblemInput(fields: FormFields<TeamReportProblemField>) {
  return { machineId: fields.machineId ?? "", description: fields.description ?? "" };
}
