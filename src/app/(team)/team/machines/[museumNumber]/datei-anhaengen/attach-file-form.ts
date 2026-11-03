import {
  addFileRefusal,
  attachTargets,
  fileCategories,
  type AddFileInput,
  type AddFileInputError,
  type FileContent,
} from "@/modules/collection";
import type { FormFields, UploadFormDefinition } from "@/app/_actions/form-action";

/**
 * The fields of the form that adds a file on a machine record (ST-037, ST-113). `content` is the name of the content the
 * browser uploaded when the file was chosen (ST-085); `fileName` is the chosen file's own name – shown to the person
 * after a rejection, and kept as the file's original file name. The machine and its machine model are bound by the page,
 * not chosen (the command checks that they exist).
 */
export const attachFileFields = [
  "machineId",
  "machineModelId",
  "attachTo",
  "title",
  "fileCategory",
  "content",
  "fileName",
] as const;
export type AttachFileField = (typeof attachFileFields)[number];

/** The form's own rejection beside the command's: it offers a choice between the machine and its machine model. */
export type AttachFormRefusal = AddFileInputError | "attach-to-required";

/** The fields every form on a machine's page that adds a file shares (ST-037, ST-054). */
type MachinePageFields = { machineId?: string; machineModelId?: string; attachTo?: string; title?: string };

/** What the file is attached to as the form chose it: the machine, or its machine model – none if no choice was made. */
export function attachedAsChosen(fields: MachinePageFields) {
  const attachTo = attachTargets.find((target) => target === fields.attachTo);
  return {
    machineIds: attachTo === "machine" && fields.machineId ? [fields.machineId] : [],
    machineModelIds: attachTo === "machine-model" && fields.machineModelId ? [fields.machineModelId] : [],
    chosen: attachTo !== undefined,
  };
}

/** The rules that need only the fields, in the order the form asks them: title, file category, then the choice. */
export function attachFormRefusal(
  fields: MachinePageFields & { fileCategory?: string },
): AttachFormRefusal | undefined {
  return (
    addFileRefusal({
      title: fields.title ?? "",
      fileCategory: fileCategories.find((category) => category === fields.fileCategory),
    }) ?? (attachedAsChosen(fields).chosen ? undefined : "attach-to-required")
  );
}

/** Reads the fields (ST-073, Q19): no validation, no default – an unknown choice is "no value given". */
function addFileInput(fields: FormFields<AttachFileField>, content: FileContent): AddFileInput {
  const { machineIds, machineModelIds } = attachedAsChosen(fields);
  return {
    title: fields.title ?? "",
    fileCategory: fileCategories.find((category) => category === fields.fileCategory),
    originalFileName: fields.fileName,
    machineIds,
    machineModelIds,
    content,
  };
}

/**
 * The form's definition for the upload runner: the uploaded content belongs to the team member who sends the form (its
 * pending upload was issued to them); the rules that need only the fields are asked first, so a missing title keeps the
 * chosen file (user, 2026-10-18).
 */
export function attachFileForm(
  onSuccess: (result: { fileId: string }) => Promise<void>,
): UploadFormDefinition<AddFileInput, { fileId: string }, AttachFileField, AttachFormRefusal> {
  return {
    fields: attachFileFields,
    upload: { field: "content", clearedWith: ["fileName"] },
    refusal: attachFormRefusal,
    input: addFileInput,
    onSuccess,
  };
}
