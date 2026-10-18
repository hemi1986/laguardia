import {
  attachFileRefusal,
  attachTargets,
  fileCategories,
  type AttachFileInput,
  type FileContent,
} from "@/modules/collection";
import type { FormFields, UploadFormDefinition } from "@/app/_actions/form-action";

/**
 * The fields of the form that attaches a file (ST-037). `content` is the name of the content the browser uploaded when
 * the file was chosen (ST-085); `fileName` only names the chosen file to the person after a rejection.
 */
export const attachFileFields = ["machineId", "attachTo", "title", "fileCategory", "content", "fileName"] as const;
export type AttachFileField = (typeof attachFileFields)[number];

/** Reads the fields (ST-073, Q19): no validation, no default – an unknown choice is "no value given". */
function attachFileInput(fields: FormFields<AttachFileField>): Omit<AttachFileInput, "content">;
function attachFileInput(fields: FormFields<AttachFileField>, content: FileContent): AttachFileInput;
function attachFileInput(fields: FormFields<AttachFileField>, content?: FileContent) {
  return {
    machineId: fields.machineId ?? "",
    attachTo: attachTargets.find((target) => target === fields.attachTo),
    title: fields.title ?? "",
    fileCategory: fileCategories.find((category) => category === fields.fileCategory),
    content,
  };
}

/**
 * The form's definition for the upload runner: the uploaded content belongs to the machine whose page the form is on
 * (its pending upload was recorded for it), whatever the file is attached to; the command's rules that need only the
 * fields are asked first, so a missing title keeps the chosen file (user, 2026-10-18).
 */
export function attachFileForm(
  onSuccess: (result: { fileId: string }) => Promise<void>,
): UploadFormDefinition<AttachFileInput, { fileId: string }, AttachFileField, NonNullable<ReturnType<typeof attachFileRefusal>>> {
  return {
    fields: attachFileFields,
    upload: { field: "content", clearedWith: ["fileName"], owner: (fields) => ({ machineId: fields.machineId ?? "" }) },
    refusal: (fields) => attachFileRefusal(attachFileInput(fields)),
    input: attachFileInput,
    onSuccess,
  };
}
