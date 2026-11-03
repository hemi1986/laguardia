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
  return {
    id: row.id,
    title: row.title,
    fileCategory: row.fileCategory,
    mediaType: fileMediaTypeOf(row.contentType),
    size: row.size,
    addedBy: row.addedBy,
    addedAt: row.addedAt,
    attachedTo: [
      ...machines.map(({ retiredAt, ...rest }): FileAttachedTo => ({
        kind: "machine",
        ...rest,
        retired: retiredAt !== null,
      })),
      ...models.map((model): FileAttachedTo => ({ kind: "machine-model", ...model })),
    ],
  };
}
