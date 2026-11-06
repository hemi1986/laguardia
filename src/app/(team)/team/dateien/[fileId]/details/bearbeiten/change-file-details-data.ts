import { fileForChange, type FileCategory } from "@/modules/collection";
import { isId, type Database } from "@/platform/command";
import { fileDetailsAddress, originOf, type FileOrigin } from "../file-origin";

/** The form „Datei bearbeiten“ (ST-116) as the page shows it: the file's current details, the version and the way back. */
export type ChangeFileDetailsData = {
  id: string;
  title: string;
  fileCategory: FileCategory;
  /** The version the form posts – the one it showed (HS-16). */
  version: number;
  /** A removed file cannot be corrected – the form says that it is gone. */
  removed: boolean;
  /** The origin the address named, checked – what the landing hands on (G17). */
  origin: FileOrigin;
  /** „Zurück zur Datei“, with the origin kept. */
  back: string;
};

/**
 * The data of „Datei bearbeiten“ (CMD-ChangeFileDetails, ST-116): Collection's file with its current title and file
 * category – removed or not, so a rejection after a removal stays – and the origin the address named, checked against
 * the closed set (G17). None for an unknown file.
 */
export async function loadChangeFileDetails(
  db: Database,
  fileId: string,
  {
    params,
    viewer,
  }: {
    params: Record<string, string | string[] | undefined>;
    viewer: { id: string; role: "helper" | "technician" };
  },
): Promise<ChangeFileDetailsData | undefined> {
  if (!isId(fileId)) return undefined;
  const file = await fileForChange(db, fileId);
  if (!file) return undefined;
  const origin = await originOf(db, params.from, viewer);
  return { ...file, origin, back: fileDetailsAddress(file.id, origin) };
}
