"use server";

import { reportAndTriage, type ReportAndTriageState } from "../report-and-triage-action";
import { reportAndResolveFields, reportAndResolveInput, type ReportAndResolveField } from "./report-and-resolve-input";

export type ReportAndResolveState = ReportAndTriageState<ReportAndResolveField>;

/**
 * CMD-ReportProblem with the triage outcome *resolved on the spot* in the same step (ST-052) – for helpers and
 * technicians. The machine record then confirms it as ST-019 does.
 */
export async function reportAndResolveAction(
  museumNumber: string,
  previous: ReportAndResolveState,
  formData: FormData,
): Promise<ReportAndResolveState> {
  return reportAndTriage(museumNumber, previous, formData, {
    fields: reportAndResolveFields,
    input: reportAndResolveInput,
    confirms: ({ problemReportId }) => `resolvedOnTheSpot=${problemReportId}`,
  });
}
