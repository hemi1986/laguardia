import { and, asc, eq, isNull } from "drizzle-orm";
import type { Database } from "@/platform/command";
import type { FileCategory } from "./add-file";
import { file, fileAttachment, machine, machineModel } from "./schema";

/** The formats the file details name (RM-FileDetails, ST-114) – every other media type is `other`. */
export const fileMediaTypes = ["pdf", "png", "jpeg", "webp", "markdown", "text", "video", "audio", "other"] as const;
export type FileMediaType = (typeof fileMediaTypes)[number];

/**
 * The format of a file by the media type the store kept (not what a form claimed). `text/plain` is *Text*, `text/markdown`
 * *Markdown*; every video and audio type reads as one; everything else is *other*.
 */
export function fileMediaTypeOf(contentType: string): FileMediaType {
  const mediaType = contentType.split(";")[0].trim().toLowerCase();
  const exact: Record<string, FileMediaType> = {
    "application/pdf": "pdf",
    "image/png": "png",
    "image/jpeg": "jpeg",
    "image/webp": "webp",
    "text/markdown": "markdown",
    "text/plain": "text",
  };
  if (exact[mediaType]) return exact[mediaType];
  if (mediaType.startsWith("video/")) return "video";
  if (mediaType.startsWith("audio/")) return "audio";
  return "other";
}

/** What a file is attached to, as its details say it (RM-FileDetails): a machine – retired or not – or a machine model. */
export type FileAttachedTo =
  | { kind: "machine"; machineId: string; museumNumber: string; machineModelTitle: string; retired: boolean }
  | { kind: "machine-model"; machineModelId: string; title: string };

/** RM-FileDetails (ST-114), without what other modules add: the AI index state and the name of *Added by*. */
export type FileDetails = {
  id: string;
  title: string;
  fileCategory: FileCategory;
  mediaType: FileMediaType;
  /** Bytes. */
  size: number;
  addedBy: string;
  addedAt: Date;
  /** Machines first, then machine models, each in the order they were attached. */
  attachedTo: FileAttachedTo[];
};

/** What a file is attached to, in the order the attachments were made – machines first, then machine models. */
async function attachedToOf(db: Database, fileId: string): Promise<FileAttachedTo[]> {
  const [machines, models] = await Promise.all([
    db
      .select({
        machineId: machine.id,
        museumNumber: machine.museumNumber,
        machineModelTitle: machineModel.title,
        retiredAt: machine.retiredAt,
      })
      .from(fileAttachment)
      .innerJoin(machine, eq(machine.id, fileAttachment.machineId))
      .innerJoin(machineModel, eq(machineModel.id, machine.machineModelId))
      .where(eq(fileAttachment.fileId, fileId))
      .orderBy(asc(fileAttachment.position)),
    db
      .select({ machineModelId: machineModel.id, title: machineModel.title })
      .from(fileAttachment)
      .innerJoin(machineModel, eq(machineModel.id, fileAttachment.machineModelId))
      .where(eq(fileAttachment.fileId, fileId))
      .orderBy(asc(fileAttachment.position)),
  ]);
  return [
    ...machines.map(({ retiredAt, ...rest }): FileAttachedTo => ({
      kind: "machine",
      ...rest,
      retired: retiredAt !== null,
    })),
    ...models.map((model): FileAttachedTo => ({ kind: "machine-model", ...model })),
  ];
}

/**
 * One file's page (RM-FileDetails, ST-114) – none for an unknown or removed file. A file attached to nothing has an
 * empty `attachedTo`. Only after the team page's access check (files are team-only).
 */
export async function fileDetails(db: Database, fileId: string): Promise<FileDetails | undefined> {
  const [row] = await db
    .select({
      id: file.id,
      title: file.title,
      fileCategory: file.fileCategory,
      contentType: file.contentType,
      size: file.size,
      addedBy: file.addedBy,
      addedAt: file.addedAt,
    })
    .from(file)
    .where(and(eq(file.id, fileId), isNull(file.removedAt)));
  if (!row) return undefined;
  return {
    id: row.id,
    title: row.title,
    fileCategory: row.fileCategory,
    mediaType: fileMediaTypeOf(row.contentType),
    size: row.size,
    addedBy: row.addedBy,
    addedAt: row.addedAt,
    attachedTo: await attachedToOf(db, fileId),
  };
}

/** A file as the question before its removal shows it (ST-121): the kept record, removed or not. */
export type FileForRemoval = {
  id: string;
  title: string;
  version: number;
  removed: boolean;
  attachedTo: FileAttachedTo[];
};

/**
 * The file the question before removing it shows (CMD-RemoveFile, ST-121): what it is attached to and the version it
 * posts – **removed or not**, so the question can answer after a removal made meanwhile. None only for an unknown file.
 * Only after the team page's access check (removal is technician-only; the command checks again).
 */
export async function fileForRemoval(db: Database, fileId: string): Promise<FileForRemoval | undefined> {
  const [row] = await db
    .select({ id: file.id, title: file.title, version: file.version, removedAt: file.removedAt })
    .from(file)
    .where(eq(file.id, fileId));
  if (!row) return undefined;
  return {
    id: row.id,
    title: row.title,
    version: row.version,
    removed: row.removedAt !== null,
    attachedTo: await attachedToOf(db, fileId),
  };
}

/** A file as the form „Datei bearbeiten“ shows it (ST-116): its current details and the version the form posts. */
export type FileForChange = {
  id: string;
  title: string;
  fileCategory: FileCategory;
  version: number;
  removed: boolean;
};

/**
 * The file the form „Datei bearbeiten“ shows (CMD-ChangeFileDetails, ST-116): **removed or not**, so the form can answer
 * a removal made meanwhile – the action re-renders this page and its rejection must stay. None only for an unknown file.
 * Only after the team page's access check (every team member may correct a file).
 */
export async function fileForChange(db: Database, fileId: string): Promise<FileForChange | undefined> {
  const [row] = await db
    .select({
      id: file.id,
      title: file.title,
      fileCategory: file.fileCategory,
      version: file.version,
      removedAt: file.removedAt,
    })
    .from(file)
    .where(eq(file.id, fileId));
  return (
    row && {
      id: row.id,
      title: row.title,
      fileCategory: row.fileCategory,
      version: row.version,
      removed: row.removedAt !== null,
    }
  );
}
