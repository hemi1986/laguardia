import { asc, eq, or } from "drizzle-orm";
import { aggregateStore, type Database } from "@/platform/command";
import { fileCategories, type AttachFileInput, type AttachingFacts, type FileCategory, type FileState } from "./attach-file";
import { opensInBrowser } from "./open-file";
import { file, machine } from "./schema";

/** How AGG-File is stored: one row per file, its owner in exactly one of two columns (check constraint). */
export const files = aggregateStore({
  type: "AGG-File",
  table: file,
  toState: (row): FileState => ({
    id: row.id,
    owner: row.machineId ? { machineId: row.machineId } : { machineModelId: row.machineModelId! },
    title: row.title,
    fileCategory: row.fileCategory,
    content: { name: row.content, size: row.size, contentType: row.contentType },
    attachedBy: row.attachedBy,
    attachedAt: row.attachedAt,
  }),
  toRow: (state: FileState) => ({
    id: state.id,
    machineId: "machineId" in state.owner ? state.owner.machineId : null,
    machineModelId: "machineModelId" in state.owner ? state.owner.machineModelId : null,
    title: state.title,
    fileCategory: state.fileCategory,
    content: state.content.name,
    size: state.content.size,
    contentType: state.content.contentType,
    attachedBy: state.attachedBy,
    attachedAt: state.attachedAt,
  }),
});

/** CMD-AttachFile's facts: the machine model of the machine whose page the form is on. */
export async function attachingFacts(tx: Database, input: AttachFileInput): Promise<AttachingFacts> {
  const [row] = await tx
    .select({ machineModelId: machine.machineModelId })
    .from(machine)
    .where(eq(machine.id, input.machineId));
  return row;
}

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
 * Other), each group by title – for the machine record's files section.
 */
export async function filesOfMachine(
  db: Database,
  { machineId, machineModelId }: { machineId: string; machineModelId: string },
): Promise<FileOfMachine[]> {
  const rows = await db
    .select({ id: file.id, title: file.title, fileCategory: file.fileCategory, machineId: file.machineId })
    .from(file)
    .where(or(eq(file.machineId, machineId), eq(file.machineModelId, machineModelId)))
    .orderBy(asc(file.title), asc(file.attachedAt));
  return rows
    .map((row) => ({ id: row.id, title: row.title, fileCategory: row.fileCategory, ofMachineModel: !row.machineId }))
    .sort((a, b) => fileCategories.indexOf(a.fileCategory) - fileCategories.indexOf(b.fileCategory));
}

/**
 * What opening a file needs (ST-037): its content's name in the storage seam, and whether the browser saves it instead
 * of opening it – none for an unknown file. Only after the team page's access check (files are team-only).
 */
export async function fileToOpen(
  db: Database,
  fileId: string,
): Promise<{ content: string; download: boolean } | undefined> {
  const [row] = await db
    .select({ content: file.content, contentType: file.contentType })
    .from(file)
    .where(eq(file.id, fileId));
  return row && { content: row.content, download: !opensInBrowser(row.contentType) };
}
