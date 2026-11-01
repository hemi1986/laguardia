import type { ChangeLegalTextsInput } from "@/modules/collection";
import type { FormFields } from "@/app/_actions/form-action";
import { versionSeen } from "@/app/_actions/version";

/** The form's own fields – only these are read and echoed after a rejection (ST-073). */
export const legalTextsFormFields = [
  "version",
  "privacyNoticeDe",
  "privacyNoticeEn",
  "imprintDe",
  "imprintEn",
] as const;

export type LegalTextsFormField = (typeof legalTextsFormFields)[number];

/**
 * Reads the form „Rechtstexte“ (ST-103, Q19): the four texts as typed – an empty one is the decision's to judge (the German
 * privacy notice is required, the others are then not provided).
 */
export function legalTextsFormInput(fields: FormFields<LegalTextsFormField>): ChangeLegalTextsInput {
  return {
    version: versionSeen(fields.version),
    privacyNoticeDe: fields.privacyNoticeDe ?? "",
    privacyNoticeEn: fields.privacyNoticeEn ?? "",
    imprintDe: fields.imprintDe ?? "",
    imprintEn: fields.imprintEn ?? "",
  };
}

/** How the form „Rechtstexte“ is read (ST-103) – what its Server Action runs and its tests post through. */
export const legalTextsFormDefinition = { fields: legalTextsFormFields, input: legalTextsFormInput } as const;
