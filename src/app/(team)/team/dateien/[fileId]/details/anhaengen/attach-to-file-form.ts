import type { ManyFormDefinition, ManyFormState } from "@/app/_actions/form-action";
import type { AttachFileInput, AttachedTo, attachFileCommand } from "@/modules/collection";
import type { CommandError } from "@/platform/command";
import { targetOf } from "../file-attachments";

/** The one field the choice posts: every ticked entry as `machine:<id>` or `machineModel:<id>` (ST-115). */
export const attachToFileFields = ["targets"] as const;
export type AttachToFileField = (typeof attachToFileFields)[number];

/** What a rejected attach answers – the command's own reasons and the command layer's, with the choice kept. */
export type AttachToFileState = ManyFormState<CommandError<typeof attachFileCommand>, AttachToFileField>;

/**
 * The form behind „Anhängen“ (ST-115): one command with every ticked entry, as posted – the runner's `many` step. The
 * two parts of G27 post under the same field; their values say which kind each is, and the input splits them into
 * machines and machine models. The file is bound by the page.
 */
export function attachToFileForm(
  fileId: string,
  onSuccess: (result: { fileId: string }) => Promise<void>,
): ManyFormDefinition<AttachFileInput, { fileId: string }, AttachToFileField> {
  return {
    fields: attachToFileFields,
    many: { field: "targets" },
    input: (_fields, chosen) => {
      const targets = chosen.flatMap((value) => {
        const target = targetOf(value);
        return target ? [target] : [];
      });
      return {
        fileId,
        machineIds: targets.flatMap((target: AttachedTo) => ("machineId" in target ? [target.machineId] : [])),
        machineModelIds: targets.flatMap((target: AttachedTo) =>
          "machineModelId" in target ? [target.machineModelId] : [],
        ),
      };
    },
    onSuccess,
  };
}
