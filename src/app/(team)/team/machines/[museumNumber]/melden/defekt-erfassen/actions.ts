"use server";

import { reportAndTriage, type ReportAndTriageState } from "../report-and-triage-action";
import {
  reportAndRecordDefectFields,
  reportAndRecordDefectInput,
  type ReportAndRecordDefectField,
} from "./report-and-record-defect-input";

export type ReportAndRecordDefectState = ReportAndTriageState<ReportAndRecordDefectField>;

/**
 * CMD-ReportProblem with the triage outcome *record a defect* in the same step (ST-023) – technicians only, which the
 * command checks. The machine record then confirms the defect and – when the form changed it – the machine's new
 * status, as ST-018 does.
 */
export async function reportAndRecordDefectAction(
  museumNumber: string,
  previous: ReportAndRecordDefectState,
  formData: FormData,
): Promise<ReportAndRecordDefectState> {
  const statusChanged = Boolean(formData.get("machineStatus"));
  return reportAndTriage(museumNumber, previous, formData, {
    fields: reportAndRecordDefectFields,
    input: reportAndRecordDefectInput,
    confirms: ({ defectId }) => `defectRecorded=${defectId ?? ""}${statusChanged ? "&statusChanged=1" : ""}`,
  });
}
