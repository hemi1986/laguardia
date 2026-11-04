import type { FormDefinition, FormState } from "@/app/_actions/form-action";
import { versionSeen } from "@/app/_actions/version";
import type { RemoveFileInput } from "@/modules/collection";
import type { removeFileCommandWithAiIndex } from "@/modules/ai-assistance";
import type { CommandError } from "@/platform/command";

/** The only field „Endgültig entfernen“ posts: the version of the file the question showed (HS-16). */
export const removeFileFields = ["version"] as const;
export type RemoveFileField = (typeof removeFileFields)[number];

/** What a rejected removal answers – the command's own reasons and the command layer's. */
export type RemoveFileState = FormState<CommandError<typeof removeFileCommandWithAiIndex>, RemoveFileField>;

/**
 * The form behind „Endgültig entfernen“ (ST-121): the file is bound by the question page, the version is posted, and the
 * removed content is deleted from the storage after the commit (ADR 0009).
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
