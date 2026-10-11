import type { RecordDefectInput } from "@/modules/repair";
import type { FormFields } from "@/app/_actions/form-action";
import { versionSeen } from "@/app/_actions/version";
import { defectInput } from "../../../defect-input";

/** The form's own fields – only these are read and echoed after a rejection (ST-073). */
export const recordDefectFields = [
  "version",
  "title",
  "priority",
  "suitableForHelpers",
  "machineStatus",
  "machineVersion",
] as const;

export type RecordDefectField = (typeof recordDefectFields)[number];

/** Reads the form „Defekt erfassen“: the problem report, the version of it the technician saw, and the defect. */
export function recordDefectInput(fields: FormFields<RecordDefectField>, problemReportId: string): RecordDefectInput {
  return { problemReportId, version: versionSeen(fields.version), ...defectInput(fields) };
}
