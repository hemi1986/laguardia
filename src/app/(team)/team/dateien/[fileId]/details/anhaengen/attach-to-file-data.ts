import type { ChoiceGroup } from "@/components/ui/grouped-choice";
import { attachmentChoice } from "@/modules/collection";
import {
  categoryAndTechnologyLabel,
  machineChoiceGroups,
  machineEntryLabel,
} from "@/app/(team)/team/category-and-technology";
import { isId, type Database } from "@/platform/command";
import { teamMessages } from "@/platform/messages";
import { targetValue } from "../file-attachments";
import { fileDetailsAddress, originOf, type FileOrigin } from "../file-origin";

/** The form „Anhängen“ (ST-115) as the page shows it: the file, the two parts of the choice and the way back. */
export type AttachToFileData = {
  id: string;
  title: string;
  /** A removed file has nothing to attach – the form says that it is gone. */
  removed: boolean;
  /** „Geräte“: the machines not attached yet, grouped by machine category and technology, retired ones at the end. */
  machineGroups: ChoiceGroup[];
  /** „Modelle“: the machine models not attached yet, grouped by machine category and technology. */
  machineModelGroups: ChoiceGroup[];
  /** The origin the address named, checked – what „Zurück zur Datei“ and the landing hand on (G17). */
  origin: FileOrigin;
  /** „Zurück zur Datei“, with the origin kept. */
  back: string;
};

/**
 * The data of the form „Anhängen“ (RM-AttachmentChoice, ST-115): Collection's choice as G27 shows it – two parts, each
 * grouped by machine category and technology, only what the file is not attached to yet. A retired machine reads
 * „LG-041 · Ausgemustert“, an active one „LG-042 · Medieval Madness“; a machine model reads its title. The origin is
 * checked against the closed set (G17). None for an unknown file; a removed file answers with nothing to choose.
 */
export async function loadAttachToFile(
  db: Database,
  fileId: string,
  {
    params,
    viewer,
  }: {
    params: Record<string, string | string[] | undefined>;
    viewer: { id: string; role: "helper" | "technician" };
  },
): Promise<AttachToFileData | undefined> {
  if (!isId(fileId)) return undefined;
  const choice = await attachmentChoice(db, fileId);
  if (!choice) return undefined;
  const origin = await originOf(db, params.from, viewer);
  return {
    id: fileId,
    title: choice.title,
    removed: choice.removed,
    machineGroups: machineChoiceGroups(choice.machineGroups, (machine) => ({
      value: targetValue({ machineId: machine.id }),
      label: machine.retired
        ? teamMessages.fileDetails.retiredMachine(machine.museumNumber)
        : machineEntryLabel(machine),
    })),
    machineModelGroups: choice.machineModelGroups.map((group) => ({
      key: `machineModel:${group.machineCategory}/${group.technology ?? ""}`,
      label: categoryAndTechnologyLabel(group.machineCategory, group.technology),
      entries: group.machineModels.map((model) => ({
        value: targetValue({ machineModelId: model.id }),
        label: model.title,
      })),
    })),
    origin,
    back: fileDetailsAddress(fileId, origin),
  };
}
