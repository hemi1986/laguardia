import { entriesOf, isId, lastCommandBy, readJournal, type Database } from "@/platform/command";
import { fileForIndexing, filesForIndexing } from "@/modules/collection";
import type { FileOwner, IndexingFailureReason } from "./ai-index-entry";
import { aiIndexStatesOfFiles, type AiIndexStateOfFile } from "./ai-index-entries";
import { aiState, type AiDependencies } from "./ai-settings";
import { aiAssistanceEvents } from "./events";

/** A file the AI cannot read (RM-AiSettings, *Files failed*): what it belongs to, its title and why. */
export type FailedFile = {
  fileId: string;
  title: string;
  owner: FileOwner;
  reason: IndexingFailureReason;
  /** The AI index entry's version – what „Erneut versuchen“ posts (CMD-IndexFileForAi by hand). */
  version: number;
};

/**
 * The AI index overview „KI-Erfassung“ (RM-AiSettings, ST-109): how many files that are not removed are indexed with
 * the current embedding model, how many wait and which failed – and what indexing has cost so far, replaced and removed
 * entries included (summed from the journal, data model *AI index entry*).
 */
export type AiIndexOverview = { indexed: number; waiting: number; failed: FailedFile[]; cost: number };

/**
 * Everything OpenRouter charged for indexing – every EVT-FileIndexedForAi ever recorded, and what an indexing that
 * failed or broke off cost before it ended (EVT-FileIndexingFailed; user, 2026-11-01 – OPEN_QUESTIONS ST-109).
 */
async function costOfIndexingSoFar(db: Database): Promise<number> {
  const entries = await readJournal(db, aiAssistanceEvents, {
    types: ["EVT-FileIndexedForAi", "EVT-FileIndexingFailed"],
  });
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
  const aiNow = await aiState(db, dependencies);
  if (!aiNow.on) return undefined;
  const [files, cost] = await Promise.all([filesForIndexing(db), costOfIndexingSoFar(db)]);
  const stateOf = await aiIndexStatesOfFiles(
    db,
    aiNow.embeddingModel,
    files.map((file) => file.id),
  );
  const overview: AiIndexOverview = { indexed: 0, waiting: 0, failed: [], cost };
  for (const file of files) {
    const inIndex = stateOf(file.id);
    if (inIndex.state === "waiting") overview.waiting += 1;
    else if (inIndex.state === "indexed") overview.indexed += 1;
    else {
      overview.failed.push({
        fileId: file.id,
        title: file.title,
        owner: file.owner,
        reason: inIndex.reason,
        version: inIndex.version,
      });
    }
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
  const aiNow = await aiState(db, dependencies);
  if (!aiNow.on) return new Set();
  const stateOf = await aiIndexStatesOfFiles(db, aiNow.embeddingModel, fileIds);
  return new Set(fileIds.filter((id) => stateOf(id).state === "failed"));
}

/**
 * The file a technician just tried again (ST-109, G3): its title, only when the latest step on the file was their own
 * „Erneut versuchen“ (EVT-FileIndexingRetried) and the file is not removed – never from the address alone.
 */
export async function fileIndexingRetriedBy(
  db: Database,
  fileId: string,
  teamMemberId: string,
): Promise<{ title: string } | undefined> {
  if (!isId(fileId)) return undefined;
  const command = await lastCommandBy(db, { aggregateId: fileId }, teamMemberId);
  if (!command || !entriesOf(aiAssistanceEvents, command).some((entry) => entry.type === "EVT-FileIndexingRetried")) {
    return undefined;
  }
  const file = await fileForIndexing(db, fileId);
  return file && { title: file.title };
}

/**
 * Where one file stands in the AI index (RM-FileDetails, ST-114): the section „KI-Erfassung“ of its details – none while
 * AI is off (G37). The same answer as the overview and the machine record give, for the current embedding model; a file
 * without an entry is waiting. Reading it starts no run.
 */
export async function aiIndexStateOfFile(
  db: Database,
  dependencies: Pick<AiDependencies, "encryptionKey">,
  fileId: string,
): Promise<AiIndexStateOfFile | undefined> {
  const aiNow = await aiState(db, dependencies);
  if (!aiNow.on) return undefined;
  const stateOf = await aiIndexStatesOfFiles(db, aiNow.embeddingModel, [fileId]);
  return stateOf(fileId);
}
