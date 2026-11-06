import type { ChoiceGroup } from "@/components/ui/grouped-choice";
import { attachmentChoiceForNewFile, fileCategories, type FileCategory } from "@/modules/collection";
import type { Database } from "@/platform/command";
import { attachmentChoiceGroups } from "../[fileId]/details/attachment-choice-groups";
import { fileOverviewAddress } from "../file-overview-query";

/** The form „Datei hinzufügen“ (ST-119) as the page shows it. */
export type AddFileFormData = {
  /** The file categories in the order the choice offers them (G20). */
  fileCategories: readonly FileCategory[];
  /** „Geräte“: every machine, grouped by machine category and technology, retired ones at the end of their group. */
  machineGroups: ChoiceGroup[];
  /** „Modelle“: every machine model, grouped by machine category and technology. */
  machineModelGroups: ChoiceGroup[];
  /** „Zurück zu den Dateien“. */
  back: string;
};

/**
 * The data of the form „Datei hinzufügen“ (RM-AttachmentChoice for a file that does not exist yet, G27): all machines –
 * retired ones included, they may be attached to (user, 2026-11-03) – and all machine models, nothing preselected.
 */
export async function loadAddFileForm(db: Database): Promise<AddFileFormData> {
  return {
    fileCategories,
    ...attachmentChoiceGroups(await attachmentChoiceForNewFile(db)),
    back: fileOverviewAddress(),
  };
}
