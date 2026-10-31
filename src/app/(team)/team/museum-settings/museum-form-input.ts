import type { ChangeMuseumDetailsInput } from "@/modules/collection";
import type { FormFields } from "@/app/_actions/form-action";
import { versionSeen } from "@/app/_actions/version";

/** The form's own fields – only these are read and echoed after a rejection (ST-073). */
export const museumFormFields = ["version", "museumName", "machinesListed"] as const;

export type MuseumFormField = (typeof museumFormFields)[number];

/**
 * Reads the form „Museum“ (ST-100, Q19): the name as typed – an empty one is the decision's to reject – and the checkbox,
 * which the browser sends only when it is ticked.
 */
export function museumFormInput(fields: FormFields<MuseumFormField>): ChangeMuseumDetailsInput {
  return {
    version: versionSeen(fields.version),
    museumName: fields.museumName ?? "",
    machinesListed: !!fields.machinesListed,
  };
}

/** How the form „Museum“ is read (ST-100) – what its Server Action runs and its tests post through. */
export const museumFormDefinition = { fields: museumFormFields, input: museumFormInput } as const;
