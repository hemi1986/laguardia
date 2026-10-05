import type { ResolveProblemOnTheSpotInput } from "@/modules/repair";
import type { FormFields } from "@/app/_actions/form-action";

/** The form's own fields – only these are read and echoed after a rejection (ST-073). */
export const resolveOnTheSpotFields = ["version", "note"] as const;

export type ResolveOnTheSpotField = (typeof resolveOnTheSpotFields)[number];

/**
 * Reads the form „Direkt behoben“ (ST-073, Q19): no validation, no default. A missing note is an empty one – the
 * command rejects it; a version that is not a whole number is one nobody saw – the command layer answers with a conflict.
 */
export function resolveOnTheSpotInput(
  fields: FormFields<ResolveOnTheSpotField>,
  problemReportId: string,
): ResolveProblemOnTheSpotInput {
  const version = Number(fields.version);
  return {
    problemReportId,
    version: fields.version && Number.isInteger(version) ? version : NO_VERSION_SEEN,
    note: fields.note ?? "",
  };
}

const NO_VERSION_SEEN = -1;
