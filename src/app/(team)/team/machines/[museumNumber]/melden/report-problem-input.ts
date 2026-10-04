import type { FormFields } from "@/app/_actions/form-action";
import type { PhotoOwner } from "@/photo";

/** The team's report form field (ST-015) – read and echoed after a rejection (ST-073). */
export const teamReportProblemFields = ["description"] as const;

export type TeamReportProblemField = (typeof teamReportProblemFields)[number];

/** The optional photo (ST-016) – taken or chosen on the phone, stored through the photo module. */
export const teamReportProblemPhoto = { field: "photo", owner: "problem-reports" } as const satisfies {
  field: string;
  owner: PhotoOwner;
};

/**
 * Reads the team's report form (Q19): no validation, no default – the description arrives as it was typed. The machine
 * is the one the server found by the page's museum number, so the problem report and the confirmation are always about
 * the same machine; an unknown one is "no machine", which CMD-ReportProblem rejects.
 */
export function teamReportProblemInput(
  fields: FormFields<TeamReportProblemField>,
  machineId: string | undefined,
  photo?: string,
) {
  return { machineId: machineId ?? "", description: fields.description ?? "", photo };
}
