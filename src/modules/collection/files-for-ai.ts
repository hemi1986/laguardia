import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import type { Database } from "@/platform/command";
import { attachedToMachineOrItsModel } from "./attached-to";
import { fileRemovalLock } from "./file-removal-lock";
import type { FileCategory } from "./add-file";
import { file } from "./schema";

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
  machineId: string,
): Promise<FileOfAiAssessmentMachine[]> {
  const rows = await db
    .select({ id: file.id, title: file.title, removedAt: file.removedAt })
    .from(file)
    .where(attachedToMachineOrItsModel(machineId))
    .orderBy(asc(file.title), asc(file.addedAt), asc(file.id));
  return rows.map(({ id, title, removedAt }) => ({ id, title, removed: removedAt !== null }));
}

/** A file an AI model proposal may offer (ST-125): its title and file category – shown only, the category belongs to the file. */
export type FileForAiModelProposal = { id: string; title: string; fileCategory: FileCategory };

/**
 * Every file that is not removed, also one attached to nothing (ADR 0018) – what the AI index is searched among when an
 * AI model proposal is written (ST-125). A removed file is never offered; what it is attached to plays no part.
 */
export async function filesForAiModelProposal(db: Database): Promise<FileForAiModelProposal[]> {
  return db
    .select({ id: file.id, title: file.title, fileCategory: file.fileCategory })
    .from(file)
    .where(isNull(file.removedAt))
    .orderBy(asc(file.title), asc(file.addedAt), asc(file.id));
}
