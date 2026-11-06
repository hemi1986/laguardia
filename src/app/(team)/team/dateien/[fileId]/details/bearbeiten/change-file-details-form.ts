import type { FormDefinition, FormFields, FormState } from "@/app/_actions/form-action";
import { versionSeen } from "@/app/_actions/version";
import { fileCategories, type ChangeFileDetailsInput, type changeFileDetailsCommand } from "@/modules/collection";
import type { CommandError } from "@/platform/command";

/** The fields of „Datei bearbeiten“ (ST-116): the title, the file category and the version the form showed (HS-16). */
export const changeFileDetailsFields = ["title", "fileCategory", "version"] as const;
export type ChangeFileDetailsField = (typeof changeFileDetailsFields)[number];

/** What a rejected correction answers – the command's own reasons and the command layer's, with what was typed kept. */
export type ChangeFileDetailsState = FormState<CommandError<typeof changeFileDetailsCommand>, ChangeFileDetailsField>;

/** Reads the fields (ST-073, Q19): no validation, no default – an unknown choice is "no value given". */
function changeFileDetailsInput(fileId: string, fields: FormFields<ChangeFileDetailsField>): ChangeFileDetailsInput {
  return {
    fileId,
    title: fields.title ?? "",
    fileCategory: fileCategories.find((category) => category === fields.fileCategory),
    version: versionSeen(fields.version),
  };
}

/** The form behind „Datei speichern“ (ST-116): the file is bound by the page; it lands on the file details (G3). */
export function changeFileDetailsForm(
  fileId: string,
  onSuccess: (result: { fileId: string; title: string }) => Promise<void>,
): FormDefinition<ChangeFileDetailsInput, { fileId: string; title: string }, ChangeFileDetailsField> {
  return {
    fields: changeFileDetailsFields,
    input: (fields) => changeFileDetailsInput(fileId, fields),
    onSuccess,
  };
}
