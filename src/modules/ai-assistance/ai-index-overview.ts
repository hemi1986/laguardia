import { and, eq, inArray } from "drizzle-orm";
import { readJournal, type Database } from "@/platform/command";
import { filesForIndexing } from "@/modules/collection";
import type { FileOwner, IndexingFailureReason } from "./ai-index-entry";
import { aiIndexingSettings, type AiDependencies } from "./ai-settings";
import { aiAssistanceEvents } from "./events";
import { aiIndexEntry } from "./schema";

/** A file the AI cannot read (RM-AiSettings, *Files failed*): what it belongs to, its title and why. */
export type FailedFile = { fileId: string; title: string; owner: FileOwner; reason: IndexingFailureReason };

/**
 * The AI index overview „KI-Erfassung“ (RM-AiSettings, ST-109): how many files that are not removed are indexed with
 * the current embedding model, how many wait and which failed – and what indexing has cost so far, replaced and removed
 * entries included (summed from the journal, data model *AI index entry*).
 */
export type AiIndexOverview = { indexed: number; waiting: number; failed: FailedFile[]; cost: number };

type EntryOfCurrentModel = { state: "indexed" | "failed"; failureReason: IndexingFailureReason | null };

/** The AI index entries made with this embedding model, by file – of these files only, when given. */
async function entriesFor(
  db: Database,
  embeddingModel: string,
  fileIds?: readonly string[],
): Promise<Map<string, EntryOfCurrentModel>> {
  const rows = await db
    .select({ id: aiIndexEntry.id, state: aiIndexEntry.state, failureReason: aiIndexEntry.failureReason })
    .from(aiIndexEntry)
    .where(
      and(
        eq(aiIndexEntry.embeddingModel, embeddingModel),
        fileIds ? inArray(aiIndexEntry.id, [...fileIds]) : undefined,
      ),
    );
  return new Map(rows.map(({ id, ...entry }) => [id, entry]));
}

/** Everything OpenRouter charged for indexing – every EVT-FileIndexedForAi ever recorded. */
async function costOfIndexingSoFar(db: Database): Promise<number> {
  const entries = await readJournal(db, aiAssistanceEvents, { types: ["EVT-FileIndexedForAi"] });
  return entries.reduce((sum, entry) => sum + (entry.data.cost ?? 0), 0);
}

/**
 * RM-AiSettings' overview (ST-109) – none while AI is off: a file is not "unreadable for the AI" while there is no AI,
 * and the overview comes back unchanged once AI is on again (user, 2026-10-31).
 */
export async function aiIndexOverview(
  db: Database,
  dependencies: Pick<AiDependencies, "encryptionKey">,
): Promise<AiIndexOverview | undefined> {
  const settings = await aiIndexingSettings(db, dependencies);
  if (!settings.aiOn || !settings.embeddingModel) return undefined;
  const [files, entries, cost] = await Promise.all([
    filesForIndexing(db),
    entriesFor(db, settings.embeddingModel),
    costOfIndexingSoFar(db),
  ]);
  const overview: AiIndexOverview = { indexed: 0, waiting: 0, failed: [], cost };
  for (const file of files) {
    const entry = entries.get(file.id);
    if (!entry) overview.waiting += 1;
    else if (entry.state === "indexed") overview.indexed += 1;
    else overview.failed.push({ fileId: file.id, title: file.title, owner: file.owner, reason: entry.failureReason! });
  }
  return overview;
}

/**
 * The files of these that the AI cannot read (RM-MachineRecord, ST-109): failed with the current embedding model.
 * None while AI is off.
 */
export async function filesTheAiCannotRead(
  db: Database,
  dependencies: Pick<AiDependencies, "encryptionKey">,
  fileIds: readonly string[],
): Promise<Set<string>> {
  if (fileIds.length === 0) return new Set();
  const settings = await aiIndexingSettings(db, dependencies);
  if (!settings.aiOn || !settings.embeddingModel) return new Set();
  const entries = await entriesFor(db, settings.embeddingModel, fileIds);
  return new Set(fileIds.filter((id) => entries.get(id)?.state === "failed"));
}
