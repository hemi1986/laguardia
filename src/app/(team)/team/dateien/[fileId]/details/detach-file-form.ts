import type { FormDefinition, FormState } from "@/app/_actions/form-action";
import type { AttachedTo, DetachFileInput, detachFileCommand } from "@/modules/collection";
import type { CommandError } from "@/platform/command";
import { attachmentTargetOf } from "./file-attachments";

/** The only field „Lösen“ posts: the target, `machine:<id>` or `machineModel:<id>` (ST-115). */
export const detachFileFields = ["target"] as const;
export type DetachFileField = (typeof detachFileFields)[number];

/** What a rejected detach answers – the command's own reasons and the command layer's. */
export type DetachFileState = FormState<CommandError<typeof detachFileCommand>, DetachFileField>;

/** What the command answers: the file and the target it was detached from (also when nothing changed). */
export type DetachFileResult = { fileId: string; target: AttachedTo };

/**
 * The one-tap form behind „Lösen“ (CMD-DetachFile, ST-115, G10a): the file and the target are bound by the page, the
 * target is posted so a forged form can be refused. Detaching what is already detached lands like a detach.
 */
export function detachFileForm(
  fileId: string,
  onSuccess: (result: DetachFileResult) => Promise<void>,
): FormDefinition<DetachFileInput, DetachFileResult, DetachFileField> {
  return {
    fields: detachFileFields,
    input: (fields) => ({ fileId, target: attachmentTargetOf(fields.target) }),
    onSuccess,
  };
}
