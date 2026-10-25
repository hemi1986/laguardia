import type { RemoveFileInput } from "@/modules/collection";
import type { FormDefinition } from "@/app/_actions/form-action";
import { versionSeen } from "@/app/_actions/version";

/** The only field „Endgültig entfernen“ posts: the version of the file the question showed (HS-16). */
export const removeFileFields = ["version"] as const;
export type RemoveFileField = (typeof removeFileFields)[number];

/**
 * The definition of the form behind „Endgültig entfernen“ (ST-038): the file is bound by the page, the version is
 * posted, and the removed content is deleted from the storage after the commit.
 */
export function removeFileForm(
  fileId: string,
  onSuccess: (result: { removedContent: string }) => Promise<void>,
): FormDefinition<RemoveFileInput, { removedContent: string }, RemoveFileField> {
  return {
    fields: removeFileFields,
    input: (fields) => ({ fileId, version: versionSeen(fields.version) }),
    onSuccess,
  };
}
