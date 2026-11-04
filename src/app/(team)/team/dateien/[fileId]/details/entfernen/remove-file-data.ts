import { fileForRemoval, type FileAttachedTo } from "@/modules/collection";
import { isId, type Database } from "@/platform/command";
import { fileDetailsAddress, originOf, type FileOrigin } from "../file-origin";

/** The question before removing a file (ST-121), as the page shows it: the kept record, where the person came from and the way back. */
export type RemoveFileData = {
  id: string;
  title: string;
  /** The version the question posts – the one it showed (HS-16). */
  version: number;
  removed: boolean;
  attachedTo: FileAttachedTo[];
  /** The origin the address named, checked – what „Zurück“ and the removal land on hand on. */
  origin: FileOrigin;
  /** „Zurück“ returns to the file details, with the origin kept (G17). */
  back: string;
};

/**
 * The removal question's data (CMD-RemoveFile, ST-121, G10b): Collection's kept file record – removed or not, so the page
 * can answer a removal made meanwhile – and the origin the address named, checked against the closed set (G17).
 */
export async function loadRemoveFile(
  db: Database,
  fileId: string,
  {
    params,
    viewer,
  }: {
    params: Record<string, string | string[] | undefined>;
    viewer: { id: string; role: "helper" | "technician" };
  },
): Promise<RemoveFileData | undefined> {
  if (!isId(fileId)) return undefined;
  const file = await fileForRemoval(db, fileId);
  if (!file) return undefined;
  const origin = await originOf(db, params.from, viewer);
  return { ...file, origin, back: fileDetailsAddress(file.id, origin) };
}
