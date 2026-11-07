import { and, asc, desc, eq, isNull, sql, type SQL } from "drizzle-orm";
import type { Database } from "@/platform/command";
import { queryOfWord, wordsOfText } from "@/platform/word-search";
import type { FileCategory } from "./add-file";
import { attachedToMachineOrItsModel, attachedToModelOrItsMachines, attachedToNothing } from "./attached-to";
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
  /**
   * Per word searched for, in their order: how well the file's own text matches it, or `null` when it does not (ST-118).
   * Empty without words.
   */
  ownRanks: (number | null)[];
};

/** The condition on the attachments – the rule is `attached-to.ts`. */
function attachedToCondition(attachedTo: NonNullable<FileOverviewFilter["attachedTo"]>): SQL {
  if (attachedTo === "nowhere") return attachedToNothing();
  if ("machineId" in attachedTo) return attachedToMachineOrItsModel(attachedTo.machineId);
  return attachedToModelOrItsMachines(attachedTo.machineModelId);
}

/**
 * A file's own text (ST-118): its title, its original file name and the names of what it is attached to – for a machine
 * its museum number and its machine model's title, for a machine model its title, always the current values, a retired
 * machine's too. Punctuation separates words; German and English word forms are kept together.
 */
const ownText = sql`(
  coalesce(${file.title}, '') || ' ' || coalesce(${file.originalFileName}, '') || ' '
  || coalesce((select string_agg(m.museum_number || ' ' || mm.title, ' ')
       from file_attachment fa join machine m on m.id = fa.machine_id join machine_model mm on mm.id = m.machine_model_id
       where fa.file_id = ${file.id}), '') || ' '
  || coalesce((select string_agg(mm.title, ' ')
       from file_attachment fa join machine_model mm on mm.id = fa.machine_model_id
       where fa.file_id = ${file.id}), ''))`;
const ownWords = wordsOfText(ownText);

/**
 * Whether and how well the file's own text (`d`, its words) matches a word: a rank, or null. A word that is a stop word in
 * both German and English (`in`, `am`) has an empty query, which matches nothing; it is no word, so every file passes it
 * with rank 0 – "Relais in Backbox" searches for „Relais“ and „Backbox“.
 */
function ownRankOf(word: string): SQL<number | null> {
  const query = queryOfWord(word);
  return sql<
    number | null
  >`case when numnode(${query}) = 0 then 0 when own.d @@ ${query} then ts_rank(own.d, ${query}) end`;
}

/** The per-word ranks of a file, its own words computed once per file (`offset 0` keeps the planner from inlining them). */
function ownRanksOf(words: readonly string[]): SQL<(number | null)[]> {
  return sql<
    (number | null)[]
  >`(select array[${sql.join(words.map(ownRankOf), sql`, `)}] from (select ${ownWords} as d offset 0) own)`;
}

/**
 * RM-FileOverview, Collection's part (ST-117, ST-118, context map step 1): every file that is not removed – also one attached to
 * nothing – that passes the filters, newest first, with – for each of the `words` searched for – how well its own text
 * matches (the words are the page's: lower-case, without punctuation; it decides which files match). The page cuts it into pages and adds the AI index state (the page
 * composes, ST-009); at a few hundred files these are a few hundred short rows. Only after the team page's access check.
 */
export async function fileOverview(
  db: Database,
  filter: FileOverviewFilter,
  words: readonly string[] = [],
): Promise<FileOverviewEntry[]> {
  const rows = await db
    .select({
      id: file.id,
      title: file.title,
      fileCategory: file.fileCategory,
      contentType: file.contentType,
      size: file.size,
      addedAt: file.addedAt,
      ownRanks: words.length > 0 ? ownRanksOf(words) : sql<number[]>`'{}'::float8[]`,
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
