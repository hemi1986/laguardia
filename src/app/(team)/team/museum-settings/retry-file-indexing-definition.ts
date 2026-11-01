import type { FormDefinition, FormFields, FormState } from "@/app/_actions/form-action";
import { versionSeen } from "@/app/_actions/version";
import type { RetryFileIndexingInput, retryFileIndexingCommand } from "@/modules/ai-assistance";
import { isId, type CommandError } from "@/platform/command";

/** What a rejected „Erneut versuchen“ answers – the command's own reasons and the command layer's. */
export type RetryFileIndexingFormError = CommandError<ReturnType<typeof retryFileIndexingCommand>>;

export type RetryFileIndexingField = "fileId" | "version";

/**
 * A posted file that is no ID – an ID no file has, so the command answers `not-found` instead of the database
 * rejecting the comparison (like `versionSeen`'s version nobody saw).
 */
export const NO_FILE = "00000000-0000-0000-0000-000000000000";

export type RetryFileIndexingState = FormState<RetryFileIndexingFormError, RetryFileIndexingField>;

/** Where „Erneut versuchen“ lands (G3): the same page, which confirms the file by the technician's own last step. */
export function retriedLanding(fileId: string): string {
  return `/team/museum-settings?retried=${encodeURIComponent(fileId)}`;
}

/**
 * „Erneut versuchen“ on a failed file (ST-109): one tap posts the file and the AI index entry's version the page showed
 * – the command decides the rule first, so a page opened while the file had failed is answered with what changed. A
 * plain module, so a test runs the real Server Action runner with it.
 */
export function retryFileIndexingForm(
  onSuccess: (result: { fileId: string }) => Promise<void>,
): FormDefinition<RetryFileIndexingInput, { fileId: string }, RetryFileIndexingField> {
  return {
    fields: ["fileId", "version"],
    input: (fields: FormFields<RetryFileIndexingField>) => ({
      fileId: fields.fileId && isId(fields.fileId) ? fields.fileId : NO_FILE,
      version: versionSeen(fields.version),
    }),
    onSuccess,
  };
}
