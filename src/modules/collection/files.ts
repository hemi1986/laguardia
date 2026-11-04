import { and, asc, eq, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import { aggregateStore, isId, lastCommandBy, replaces, type Database } from "@/platform/command";
import {
  fileCategories,
  type AddFileInput,
  type AddingFacts,
  type Attachment,
  type FileCategory,
  type FileState,
} from "./add-file";
import type { AttachFileInput, AttachingFacts } from "./attach-file";
import { fileRemovalLock } from "./file-removal-lock";
import { fileRemovedIn } from "./in-command";
import { opensInBrowser } from "./open-file";
import { file, fileAttachment, machine, machineModel } from "./schema";

/** The attachments of a file (ST-113): saved with the file as a whole, in the order they were made. */
const attachments = replaces({
  table: fileAttachment,
  owner: "fileId",
  toEntry: (row): Attachment =>
    row.machineId ? { id: row.id, machineId: row.machineId } : { id: row.id, machineModelId: row.machineModelId! },
  toRow: (attachment) => ({
    id: attachment.id,
    machineId: "machineId" in attachment ? attachment.machineId : null,
    machineModelId: "machineModelId" in attachment ? attachment.machineModelId : null,
  }),
});

/** How AGG-File is stored: one row per file, and its attachments – each to a machine or to a machine model. */
export const files = aggregateStore({
  type: "AGG-File",
  table: file,
  replaces: { attachments },
  toState: (row, lists): FileState => ({
    id: row.id,
    title: row.title,
    fileCategory: row.fileCategory,
    ...(row.originalFileName && { originalFileName: row.originalFileName }),
    content: { name: row.content, size: row.size, contentType: row.contentType },
    attachments: lists.attachments,
    addedBy: row.addedBy,
    addedAt: row.addedAt,
    ...(row.removedBy && row.removedAt && { removed: { by: row.removedBy, at: row.removedAt } }),
  }),
  toRow: (state: FileState) => ({
    id: state.id,
    title: state.title,
    fileCategory: state.fileCategory,
    originalFileName: state.originalFileName ?? null,
    content: state.content.name,
    size: state.content.size,
    contentType: state.content.contentType,
    addedBy: state.addedBy,
    addedAt: state.addedAt,
    removedBy: state.removed?.by ?? null,
    removedAt: state.removed?.at ?? null,
  }),
});

/** Whether every machine and machine model the input names exists – CMD-AddFile's and CMD-AttachFile's one rule. */
async function targetsExist(
  tx: Database,
  machineIds: readonly string[],
  machineModelIds: readonly string[],
): Promise<boolean> {
  const machines = [...new Set(machineIds)];
  const models = [...new Set(machineModelIds)];
  // An ID that is no ID names nothing – a forged form field, not a database error.
  if (![...machines, ...models].every(isId)) return false;
  const [foundMachines, foundModels] = await Promise.all([
    machines.length ? tx.select({ id: machine.id }).from(machine).where(inArray(machine.id, machines)) : [],
    models.length ? tx.select({ id: machineModel.id }).from(machineModel).where(inArray(machineModel.id, models)) : [],
  ]);
  return foundMachines.length === machines.length && foundModels.length === models.length;
}

/** CMD-AddFile's facts: whether every machine and machine model the input names exists. */
export async function addingFacts(tx: Database, input: AddFileInput): Promise<AddingFacts> {
  return { everythingExists: await targetsExist(tx, input.machineIds, input.machineModelIds) };
}

/** CMD-AttachFile's facts (ST-115): whether every machine and machine model it names exists – retired machines included. */
export async function attachingFacts(tx: Database, input: AttachFileInput): Promise<AttachingFacts> {
  return { everythingExists: await targetsExist(tx, input.machineIds, input.machineModelIds) };
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
    .select({
      id: file.id,
      title: file.title,
      fileCategory: file.fileCategory,
      addedAt: file.addedAt,
      ofMachineModel: sql<boolean>`bool_or(${fileAttachment.machineModelId} is not null)`,
    })
    .from(file)
    .innerJoin(fileAttachment, eq(fileAttachment.fileId, file.id))
    .where(and(ofMachineOrModel({ machineId, machineModelId }), isNull(file.removedAt)))
    .groupBy(file.id)
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
  const [owner] = await db
    .select({ machineModelId: machine.machineModelId })
    .from(machine)
    .where(eq(machine.id, machineId));
  if (!owner) return undefined;
  const [row] = await db
    .select({ id: file.id, title: file.title })
    .from(file)
    .innerJoin(fileAttachment, eq(fileAttachment.fileId, file.id))
    .where(and(eq(file.id, fileId), ofMachineOrModel({ machineId, machineModelId: owner.machineModelId })))
    .groupBy(file.id);
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

/** The attachments to a machine or to its machine model – what makes a file show on the machine's record. */
function ofMachineOrModel({ machineId, machineModelId }: { machineId: string; machineModelId: string }) {
  return or(eq(fileAttachment.machineId, machineId), eq(fileAttachment.machineModelId, machineModelId));
}

/** A file as AI assistance reads it to index it (ST-106) – only a file that is not removed, whatever it is attached to. */
export type FileForIndexing = {
  id: string;
  title: string;
  content: { name: string; size: number; contentType: string };
};

const fileForIndexingColumns = {
  id: file.id,
  title: file.title,
  content: file.content,
  size: file.size,
  contentType: file.contentType,
};

function fileForIndexingOf(row: {
  id: string;
  title: string;
  content: string;
  size: number;
  contentType: string;
}): FileForIndexing {
  return { id: row.id, title: row.title, content: { name: row.content, size: row.size, contentType: row.contentType } };
}

/**
 * The files that are not removed – what the AI index can hold (ST-106), also one attached to nothing (ADR 0018) – in the
 * order they were added; files added at the same instant by their ID, so the order is stable.
 */
export async function filesForIndexing(db: Database): Promise<FileForIndexing[]> {
  const rows = await db
    .select(fileForIndexingColumns)
    .from(file)
    .where(isNull(file.removedAt))
    .orderBy(asc(file.addedAt), asc(file.id));
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

/** A file as an AI assessment's reference needs it (ST-107): its title and whether it was removed. */
export type FileForAiReference = { title: string; removed: boolean };

/**
 * The files an AI assessment's references name, removed or not (ST-107): a removed file keeps its title and is shown
 * without a link (RM-DefectAiAssessments). What a file is attached to now plays no part – a reference stays as it was
 * written (ST-120).
 */
export async function filesForAiReferences(
  db: Database,
  fileIds: readonly string[],
): Promise<Map<string, FileForAiReference>> {
  if (fileIds.length === 0) return new Map();
  const rows = await db
    .select({ id: file.id, title: file.title, removedAt: file.removedAt })
    .from(file)
    .where(inArray(file.id, [...new Set(fileIds)]));
  return new Map(rows.map(({ id, title, removedAt }) => [id, { title, removed: removedAt !== null }]));
}

/** A file attached to the defect's machine or its machine model, as an AI assessment sends and checks it (ST-107). */
export type FileOfAiAssessmentMachine = FileForAiReference & { id: string };

/**
 * Every file attached to the defect's machine or to its machine model, removed ones included (a reference to a removed
 * file is kept by its title, ST-108), each once, also when attached to both (ST-120). AI assistance reads it once, when
 * an AI assessment's writing begins: it limits the search, is what the chat model is told and is what references are
 * checked against (CMD-WriteAiAssessment rule, ADR 0018).
 */
export async function filesOfMachineAndModelForAi(
  db: Database,
  { machineId, machineModelId }: { machineId: string; machineModelId: string },
): Promise<FileOfAiAssessmentMachine[]> {
  const rows = await db
    .selectDistinct({ id: file.id, title: file.title, removedAt: file.removedAt, addedAt: file.addedAt })
    .from(file)
    .innerJoin(fileAttachment, eq(fileAttachment.fileId, file.id))
    .where(ofMachineOrModel({ machineId, machineModelId }))
    .orderBy(asc(file.title), asc(file.addedAt), asc(file.id));
  return rows.map(({ id, title, removedAt }) => ({ id, title, removed: removedAt !== null }));
}
