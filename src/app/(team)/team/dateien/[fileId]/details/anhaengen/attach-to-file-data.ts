import type { ChoiceGroup } from "@/components/ui/grouped-choice";
import { attachmentChoice } from "@/modules/collection";
import { isId, type Database } from "@/platform/command";
import { attachmentChoiceGroups } from "../attachment-choice-groups";
import { originAndBack, type FileOrigin } from "../../../file-navigation";

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
  return {
    id: fileId,
    title: choice.title,
    removed: choice.removed,
    ...attachmentChoiceGroups(choice),
    ...(await originAndBack(db, fileId, params.from, viewer)),
  };
}
