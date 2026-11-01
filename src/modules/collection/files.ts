import { and, asc, eq, isNull, or } from "drizzle-orm";
import { aggregateStore, type Database } from "@/platform/command";
import {
  fileCategories,
  type AttachFileInput,
  type AttachingFacts,
  type FileCategory,
  type FileState,
} from "./attach-file";
import { fileRemovalLock } from "./file-removal-lock";
import { opensInBrowser } from "./open-file";
import { file, machine, machineModel } from "./schema";

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
    ...(row.removedBy && row.removedAt && { removed: { by: row.removedBy, at: row.removedAt } }),
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
    removedBy: state.removed?.by ?? null,
    removedAt: state.removed?.at ?? null,
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
 * Other), each group by title – for the machine record's files section. A removed file is not among them (ST-038).
 */
export async function filesOfMachine(
  db: Database,
  { machineId, machineModelId }: { machineId: string; machineModelId: string },
): Promise<FileOfMachine[]> {
  const rows = await db
    .select({ id: file.id, title: file.title, fileCategory: file.fileCategory, machineId: file.machineId })
    .from(file)
    .where(and(ofMachineOrModel({ machineId, machineModelId }), isNull(file.removedAt)))
    .orderBy(asc(file.title), asc(file.attachedAt));
  return rows
    .map((row) => ({ id: row.id, title: row.title, fileCategory: row.fileCategory, ofMachineModel: !row.machineId }))
    .sort((a, b) => fileCategories.indexOf(a.fileCategory) - fileCategories.indexOf(b.fileCategory));
}

/**
 * What opening a file needs (ST-037): its content's name in the storage seam, and whether the browser saves it instead
 * of opening it – none for an unknown or removed file (ST-038). Only after the team page's access check (files are team-only).
 */
export async function fileToOpen(
  db: Database,
  fileId: string,
): Promise<{ content: string; download: boolean } | undefined> {
  const [row] = await db
    .select({ content: file.content, contentType: file.contentType })
    .from(file)
    .where(and(eq(file.id, fileId), isNull(file.removedAt)));
  return row && { content: row.content, download: !opensInBrowser(row.contentType) };
}

/** A file of one machine's page (ST-038): what the question before removing it shows and posts, removed or not. */
export type MachineFile = {
  id: string;
  title: string;
  version: number;
  removed: boolean;
  /** The machine model's title, for a file of the machine model – it disappears from every machine of that model. */
  machineModel?: string;
};

/**
 * A file of a machine or of its machine model, removed or not – none for any other file (ST-038): the question before
 * removing it, and the confirmation afterwards, which names the file the machine record no longer lists.
 */
export async function machineFile(
  db: Database,
  { fileId, machineId }: { fileId: string; machineId: string },
): Promise<MachineFile | undefined> {
  const [owner] = await db
    .select({ machineModelId: machine.machineModelId, machineModelTitle: machineModel.title })
    .from(machine)
    .innerJoin(machineModel, eq(machineModel.id, machine.machineModelId))
    .where(eq(machine.id, machineId));
  if (!owner) return undefined;
  const [row] = await db
    .select({
      id: file.id,
      title: file.title,
      version: file.version,
      removedAt: file.removedAt,
      ofMachineModel: file.machineModelId,
    })
    .from(file)
    .where(and(eq(file.id, fileId), ofMachineOrModel({ machineId, machineModelId: owner.machineModelId })));
  return (
    row && {
      id: row.id,
      title: row.title,
      version: row.version,
      removed: row.removedAt !== null,
      ...(row.ofMachineModel && { machineModel: owner.machineModelTitle }),
    }
  );
}

/** The files of a machine and those of its machine model – what its machine record shows. */
function ofMachineOrModel({ machineId, machineModelId }: { machineId: string; machineModelId: string }) {
  return or(eq(file.machineId, machineId), eq(file.machineModelId, machineModelId));
}

/** A file as AI assistance reads it to index it (ST-106) – only a file that is not removed. */
export type FileForIndexing = {
  id: string;
  owner: { machineId: string } | { machineModelId: string };
  title: string;
  content: { name: string; size: number; contentType: string };
};

const fileForIndexingColumns = {
  id: file.id,
  machineId: file.machineId,
  machineModelId: file.machineModelId,
  title: file.title,
  content: file.content,
  size: file.size,
  contentType: file.contentType,
};

function fileForIndexingOf(row: {
  id: string;
  machineId: string | null;
  machineModelId: string | null;
  title: string;
  content: string;
  size: number;
  contentType: string;
}): FileForIndexing {
  return {
    id: row.id,
    owner: row.machineId ? { machineId: row.machineId } : { machineModelId: row.machineModelId! },
    title: row.title,
    content: { name: row.content, size: row.size, contentType: row.contentType },
  };
}

/** The files of every machine and machine model that are not removed – what the AI index can hold (ST-106). */
export async function filesForIndexing(db: Database): Promise<FileForIndexing[]> {
  const rows = await db
    .select(fileForIndexingColumns)
    .from(file)
    .where(isNull(file.removedAt))
    .orderBy(asc(file.attachedAt));
  return rows.map(fileForIndexingOf);
}

/**
 * One file as indexing reads it – none for an unknown or removed file. The slow part of an indexing reads it this way;
 * the transaction that stores the result reads it again under the file's removal lock (`fileForIndexingWhileStoring`).
 */
export async function fileForIndexing(db: Database, fileId: string): Promise<FileForIndexing | undefined> {
  const [row] = await db
    .select(fileForIndexingColumns)
    .from(file)
    .where(and(eq(file.id, fileId), isNull(file.removedAt)));
  return row && fileForIndexingOf(row);
}

/**
 * The file as the AI index's storing transaction reads it: under the file's removal lock taken shared (ADR 0014), so
 * a removal waits for the store and an indexing that read the file before its removal never brings it back. None when
 * the file was removed meanwhile – the transaction then stores nothing.
 */
export async function fileForIndexingWhileStoring(tx: Database, fileId: string): Promise<FileForIndexing | undefined> {
  await fileRemovalLock(tx, fileId, "shared");
  return fileForIndexing(tx, fileId);
}
