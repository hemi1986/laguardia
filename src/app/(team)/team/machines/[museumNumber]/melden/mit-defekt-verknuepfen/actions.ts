"use server";

import { reportAndTriage, type ReportAndTriageState } from "../report-and-triage-action";
import { reportAndLinkFields, reportAndLinkInput, type ReportAndLinkField } from "./report-and-link-input";

export type ReportAndLinkState = ReportAndTriageState<ReportAndLinkField>;

/**
 * CMD-ReportProblem with the triage outcome *linked* in the same step (ST-052) – technicians only, which the command
 * checks; it checks the chosen defect again too. The machine record then confirms it naming the defect, as ST-022 does.
 */
export async function reportAndLinkAction(
  museumNumber: string,
  previous: ReportAndLinkState,
  formData: FormData,
): Promise<ReportAndLinkState> {
  return reportAndTriage(museumNumber, previous, formData, {
    fields: reportAndLinkFields,
    input: reportAndLinkInput,
    confirms: ({ problemReportId }) => `linked=${problemReportId}`,
  });
}
