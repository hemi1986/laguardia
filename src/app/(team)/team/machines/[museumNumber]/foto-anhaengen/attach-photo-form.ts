import type { AddFileInput } from "@/modules/collection";
import type { FormFields, PhotoFormDefinition } from "@/app/_actions/form-action";
import { attachedAsChosen, attachFormRefusal, type AttachFormRefusal } from "../datei-anhaengen/attach-file-form";

/**
 * The fields of the form that adds a camera photo as a file (ST-054, ST-113). The photo itself is the file field
 * `photo`; there is no file category to choose – the page adds photos (user, 2026-10-25). The machine and its machine
 * model are bound by the page.
 */
export const attachPhotoFields = ["machineId", "machineModelId", "attachTo", "title"] as const;
export type AttachPhotoField = (typeof attachPhotoFields)[number];

/**
 * The form's definition for the photo runner: the photo goes through the photo module (upright, downscaled, without
 * metadata) and becomes a file of the file category Photo – attached to the machine whose page the form is on, or to its
 * machine model – with the name the photo had. Reads the fields (Q19): no validation, no default; an unknown target is
 * "no value given", which the form refuses before the photo is stored.
 */
export function attachPhotoForm(
  onSuccess: (result: { fileId: string }) => Promise<void>,
): PhotoFormDefinition<AddFileInput, { fileId: string }, AttachPhotoField, AttachFormRefusal> {
  return {
    fields: attachPhotoFields,
    photo: { field: "photo", owner: "files" },
    // The file category is always Photo, so only the choice can be missing – and the title, which the command asks.
    refusal: (fields: FormFields<AttachPhotoField>) =>
      attachedAsChosen(fields).chosen ? undefined : attachFormRefusal({ ...fields, fileCategory: "photo" }),
    input: (fields: FormFields<AttachPhotoField>, _photo, stored, originalName) => {
      const { machineIds, machineModelIds } = attachedAsChosen(fields);
      return {
        title: fields.title ?? "",
        fileCategory: "photo",
        originalFileName: originalName,
        machineIds,
        machineModelIds,
        content: stored,
      };
    },
    onSuccess,
  };
}
