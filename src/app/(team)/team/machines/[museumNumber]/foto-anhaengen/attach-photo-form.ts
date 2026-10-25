import { attachTargets, type AttachFileInput } from "@/modules/collection";
import type { FormFields, PhotoFormDefinition } from "@/app/_actions/form-action";

/**
 * The fields of the form that attaches a camera photo as a file (ST-054). The photo itself is the file field `photo`;
 * there is no file category to choose – the page attaches photos (user, 2026-10-25).
 */
export const attachPhotoFields = ["machineId", "attachTo", "title"] as const;
export type AttachPhotoField = (typeof attachPhotoFields)[number];

/**
 * The form's definition for the photo runner: the photo goes through the photo module (upright, downscaled, without
 * metadata) and becomes a file of the file category Photo – of the machine whose page the form is on, or of its
 * machine model. Reads the fields (Q19): no validation, no default; an unknown target is "no value given".
 */
export function attachPhotoForm(
  onSuccess: (result: { fileId: string }) => Promise<void>,
): PhotoFormDefinition<AttachFileInput, { fileId: string }, AttachPhotoField> {
  return {
    fields: attachPhotoFields,
    photo: { field: "photo", owner: "files" },
    input: (fields: FormFields<AttachPhotoField>, _photo, stored) => ({
      machineId: fields.machineId ?? "",
      attachTo: attachTargets.find((target) => target === fields.attachTo),
      title: fields.title ?? "",
      fileCategory: "photo",
      content: stored,
    }),
    onSuccess,
  };
}
