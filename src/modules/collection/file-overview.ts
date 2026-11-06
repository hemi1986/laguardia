import { and, asc, desc, eq, isNull, sql, type SQL } from "drizzle-orm";
import type { Database } from "@/platform/command";
import type { FileCategory } from "./add-file";
import { fileMediaTypeOf, type FileMediaType } from "./file-details";
import { file, machine, machineModel } from "./schema";

/**
 * What the file overview is narrowed to (RM-FileOverview, ST-117) – every filter that is set has to hold. "Attached to"
 * follows HS-36: a machine finds what its machine record shows (attached to it or to its machine model), a machine model
 * what is attached to it or to any of its machines, retired ones included; `"nowhere"` finds the files without any
 * attachment.
 */
export type FileOverviewFilter = {
  fileCategory?: FileCategory;
  attachedTo?: "nowhere" | { machineId: string } | { machineModelId: string };
};

/** One file of the overview (RM-FileOverview): what an entry shows, without what other modules add. */
export type FileOverviewEntry = {
  id: string;
  title: string;
  fileCategory: FileCategory;
  mediaType: FileMediaType;
  /** Bytes. */
  size: number;
  addedAt: Date;
};

/** The condition on the attachments, as a subquery on the outer `file` row. */
function attachedToCondition(attachedTo: NonNullable<FileOverviewFilter["attachedTo"]>): SQL {
  if (attachedTo === "nowhere") {
    return sql`not exists (select 1 from file_attachment fa where fa.file_id = ${file.id})`;
  }
  if ("machineId" in attachedTo) {
    return sql`exists (
      select 1 from file_attachment fa
      where fa.file_id = ${file.id}
        and (fa.machine_id = ${attachedTo.machineId}
          or fa.machine_model_id = (select m.machine_model_id from machine m where m.id = ${attachedTo.machineId})))`;
  }
  return sql`exists (
    select 1 from file_attachment fa
    where fa.file_id = ${file.id}
      and (fa.machine_model_id = ${attachedTo.machineModelId}
        or fa.machine_id in (select m.id from machine m where m.machine_model_id = ${attachedTo.machineModelId})))`;
}

/**
 * RM-FileOverview, Collection's part (ST-117, context map step 1): every file that is not removed – also one attached to
 * nothing – that passes the filters, newest first. The page cuts it into pages and adds the AI index state (the page
 * composes, ST-009); at a few hundred files these are a few hundred short rows. Only after the team page's access check.
 */
export async function fileOverview(db: Database, filter: FileOverviewFilter): Promise<FileOverviewEntry[]> {
  const rows = await db
    .select({
      id: file.id,
      title: file.title,
      fileCategory: file.fileCategory,
      contentType: file.contentType,
      size: file.size,
      addedAt: file.addedAt,
    })
    .from(file)
    .where(
      and(
        isNull(file.removedAt),
        filter.fileCategory ? eq(file.fileCategory, filter.fileCategory) : undefined,
        filter.attachedTo ? attachedToCondition(filter.attachedTo) : undefined,
      ),
    )
    .orderBy(desc(file.addedAt), desc(file.id));
  return rows.map(({ contentType, ...row }) => ({ ...row, mediaType: fileMediaTypeOf(contentType) }));
}

/** What the filter „Angehängt an“ offers (ST-117): the machines and the machine models, to be named by the page. */
export type FileOverviewChoices = {
  /** By museum number, retired machines at the end. */
  machines: { id: string; museumNumber: string; machineModelTitle: string; retired: boolean }[];
  /** By title. */
  machineModels: { id: string; title: string }[];
};

/** The machines and machine models the filter „Angehängt an“ can narrow to – retired machines included (user, 2026-11-02). */
export async function fileOverviewChoices(db: Database): Promise<FileOverviewChoices> {
  const [machines, machineModels] = await Promise.all([
    db
      .select({
        id: machine.id,
        museumNumber: machine.museumNumber,
        machineModelTitle: machineModel.title,
        retiredAt: machine.retiredAt,
      })
      .from(machine)
      .innerJoin(machineModel, eq(machineModel.id, machine.machineModelId))
      .orderBy(asc(machine.museumNumber)),
    db.select({ id: machineModel.id, title: machineModel.title }).from(machineModel).orderBy(asc(machineModel.title)),
  ]);
  const choice = ({ retiredAt, ...rest }: (typeof machines)[number]) => ({ ...rest, retired: retiredAt !== null });
  return {
    machines: [...machines.filter((m) => m.retiredAt === null), ...machines.filter((m) => m.retiredAt !== null)].map(
      choice,
    ),
    machineModels,
  };
}
