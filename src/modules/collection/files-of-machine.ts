import { and, asc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { isId, lastCommandBy, type Database } from "@/platform/command";
import { safeFileName } from "@/platform/storage/content-disposition";
import { fileCategories, type FileCategory } from "./add-file";
import { attachedToItsModel, attachedToMachineOrItsModel } from "./attached-to";
import { fileRemovedIn } from "./in-command";
import { opensInBrowser } from "./open-file";
import { file } from "./schema";

/** A file as the machine record lists it (RM-MachineRecord, ST-037). */
export type FileOfMachine = {
  id: string;
  title: string;
  fileCategory: FileCategory;
  /** Attached to the machine model – every machine of that model shows it – rather than to this machine only. */
  ofMachineModel: boolean;
};

/**
 * The files of a machine and of its machine model, by file category in glossary order (Manual, Schematic, Photo,
 * Other), each group by title – for the machine record's files section. A removed file is not among them (ST-038).
 */
export async function filesOfMachine(db: Database, machineId: string): Promise<FileOfMachine[]> {
  const rows = await db
    .select({
      id: file.id,
      title: file.title,
      fileCategory: file.fileCategory,
      addedAt: file.addedAt,
      ofMachineModel: sql<boolean>`${attachedToItsModel(machineId)}`,
    })
    .from(file)
    .where(and(attachedToMachineOrItsModel(machineId), isNull(file.removedAt)))
    .orderBy(asc(file.title), asc(file.addedAt));
  // A file attached to both shows once, with the mark of its machine model: every machine of the model shows it.
  return rows
    .map((row) => ({
      id: row.id,
      title: row.title,
      fileCategory: row.fileCategory,
      ofMachineModel: row.ofMachineModel,
    }))
    .sort((a, b) => fileCategories.indexOf(a.fileCategory) - fileCategories.indexOf(b.fileCategory));
}

/**
 * What opening a file needs (ST-037): its content's name in the storage seam, and whether the browser saves it instead
 * of opening it, and the name it is saved or opened under (ST-119) – none for an unknown or removed file (ST-038). Only after the team page's access check (files are team-only).
 */
export async function fileToOpen(
  db: Database,
  fileId: string,
): Promise<{ content: string; download: boolean; fileName?: string } | undefined> {
  const [row] = await db
    .select({ content: file.content, contentType: file.contentType, originalFileName: file.originalFileName })
    .from(file)
    .where(and(eq(file.id, fileId), isNull(file.removedAt)));
  if (!row) return undefined;
  // The name the file had on the device it came from (ST-119), made safe – none for a file from before the feature.
  const fileName = row.originalFileName ? safeFileName(row.originalFileName) : undefined;
  return { content: row.content, download: !opensInBrowser(row.contentType), ...(fileName && { fileName }) };
}

/** A file of one machine's page (ST-038, ST-121): what the removal confirmation names. */
export type MachineFile = {
  id: string;
  title: string;
};

/**
 * A file of a machine or of its machine model, removed or not – none for any other file (ST-038, ST-121): the
 * confirmation after a removal, which names the file the machine record no longer lists.
 */
export async function machineFile(
  db: Database,
  { fileId, machineId }: { fileId: string; machineId: string },
): Promise<MachineFile | undefined> {
  const [row] = await db
    .select({ id: file.id, title: file.title })
    .from(file)
    .where(and(eq(file.id, fileId), attachedToMachineOrItsModel(machineId)));
  return row && { id: row.id, title: row.title };
}

/**
 * The file a technician just removed (ST-121, G3): its title, only when the latest step on the file was their own
 * CMD-RemoveFile and the file is really removed – never from the address alone.
 */
export async function fileRemovedBy(
  db: Database,
  fileId: string,
  teamMemberId: string,
): Promise<{ title: string } | undefined> {
  if (!isId(fileId)) return undefined;
  const command = await lastCommandBy(db, { aggregateId: fileId }, teamMemberId);
  if (!command || !fileRemovedIn(command, fileId)) return undefined;
  const [row] = await db
    .select({ title: file.title })
    .from(file)
    .where(and(eq(file.id, fileId), isNotNull(file.removedAt)));
  return row && { title: row.title };
}
