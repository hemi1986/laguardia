import type { FormFields } from "@/app/_actions/form-action";
import { TEST_MACHINE_ID } from "@/spike/test-machine";

/** The fields of the spike's problem report form (ST-001) and their conversion to CMD-ReportProblem's input (Q19). */
export const reportProblemFields = ["description"] as const;

export function reportProblemInput({ description }: FormFields<(typeof reportProblemFields)[number]>) {
  return { machineId: TEST_MACHINE_ID, description: description ?? "" };
}
