import type { FormFields, UploadFormDefinition } from "@/app/_actions/form-action";
import {
  addFileRefusal,
  fileCategories,
  type AddFileInput,
  type AddFileInputError,
  type FileContent,
} from "@/modules/collection";
import { targetOf } from "../[fileId]/details/file-attachments";

/**
 * The fields of the form „Datei hinzufügen“ in the file overview (ST-119). `content` is the name of the content the
 * browser uploaded when the file was chosen (ST-085); `fileName` is the chosen file's own name – shown after a
 * rejection, and kept as the file's original file name. What the file is attached to is posted under `targets`, one
 * value per ticked entry (`machine:<id>`, `machineModel:<id>`), and comes back as `chosen`.
 */
export const addFileFields = ["title", "fileCategory", "content", "fileName"] as const;
export type AddFileField = (typeof addFileFields)[number];

/** The field the choice posts. */
export const ADD_FILE_TARGETS = "targets";

/** The rules that need only the fields, in the order the form asks them: title, then file category. */
export function addFileFormRefusal(fields: { title?: string; fileCategory?: string }): AddFileInputError | undefined {
  return addFileRefusal({
    title: fields.title ?? "",
    fileCategory: fileCategories.find((category) => category === fields.fileCategory),
  });
}

/** Reads the fields (ST-073, Q19): no validation, no default – an unknown choice is "no value given". */
function addFileInput(fields: FormFields<AddFileField>, content: FileContent, chosen: readonly string[]): AddFileInput {
  const targets = chosen.flatMap((value) => {
    const target = targetOf(value);
    return target ? [target] : [];
  });
  return {
    title: fields.title ?? "",
    fileCategory: fileCategories.find((category) => category === fields.fileCategory),
    originalFileName: fields.fileName,
    machineIds: targets.flatMap((target) => ("machineId" in target ? [target.machineId] : [])),
    machineModelIds: targets.flatMap((target) => ("machineModelId" in target ? [target.machineModelId] : [])),
    content,
  };
}

/**
 * The form's definition for the upload runner: the uploaded content belongs to the team member who sends the form; the
 * rules that need only the fields are asked first, so a missing title keeps the chosen file (user, 2026-10-18).
 */
export function addFileForm(
  onSuccess: (result: { fileId: string }) => Promise<void>,
): UploadFormDefinition<AddFileInput, { fileId: string }, AddFileField, AddFileInputError> {
  return {
    fields: addFileFields,
    upload: { field: "content", clearedWith: ["fileName"], choice: ADD_FILE_TARGETS },
    refusal: addFileFormRefusal,
    input: addFileInput,
    onSuccess,
  };
}
