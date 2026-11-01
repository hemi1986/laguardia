import type { Decision, DecisionContext } from "@/platform/command";

/**
 * CMD-IndexFileForAi (AGG-AiIndexEntry, ST-106): the result of indexing one file for AI – either the file's passages,
 * page images and images with their embeddings, or one reason it failed. The slow part (reading the file, rendering
 * the pages, asking OpenRouter) runs in the background outside any transaction (ADR 0015); this decision only applies
 * the result to the file's AI index entry, which is replaced as a whole.
 */

/** Why a file is not in the AI index (EVT-FileIndexingFailed, data model *AI index entry*). */
export const indexingFailureReasons = [
  "not readable",
  "format not indexed",
  "OpenRouter refused",
  "OpenRouter not reachable",
  "broken off",
] as const;
export type IndexingFailureReason = (typeof indexingFailureReasons)[number];

/** What an indexed item is – a text passage, a PDF page rendered as an image, or an image file (data model). */
export const indexItemKinds = ["passage", "page-image", "image"] as const;
export type IndexItemKind = (typeof indexItemKinds)[number];

/** The file's owner, copied once: a file belongs to exactly one machine or one machine model and never changes. */
export type FileOwner = { machineId: string } | { machineModelId: string };

/** The owner of a stored AI index entry row – one of its two columns is set (CHECK constraint). */
export function ownerOf(row: { machineId: string | null; machineModelId: string | null }): FileOwner {
  return row.machineId ? { machineId: row.machineId } : { machineModelId: row.machineModelId! };
}

/** The two owner columns of an AI index entry, for its row and its journal projection. */
export function ownerColumns(owner: FileOwner): { machineId: string | null; machineModelId: string | null } {
  return {
    machineId: "machineId" in owner ? owner.machineId : null,
    machineModelId: "machineModelId" in owner ? owner.machineModelId : null,
  };
}

/** One thing the AI index holds of a file, with where it came from and its embedding. Never journaled. */
export type AiIndexItem = {
  id: string;
  kind: IndexItemKind;
  /** The PDF page it came from – absent for a text, Markdown or image file. */
  page?: number;
  /** The passage's text – only for a passage; an image is embedded as it is. */
  text?: string;
  /** 1536 numbers made with the entry's one embedding model (ADR 0014, HS-34). */
  embedding: number[];
};

/** AGG-AiIndexEntry – current state (docs/architecture/data-model.md). */
export type AiIndexEntryState = {
  /** The file's ID – a file has at most one AI index entry. */
  id: string;
  owner: FileOwner;
  state: "indexed" | "failed";
  /** The one embedding model everything of this entry was made with. */
  embeddingModel: string;
  /** Indexed or failed at. */
  at: Date;
  /** Exactly one reason when failed, none when indexed. */
  failureReason?: IndexingFailureReason;
  /** A PDF's page count – 0 for a text, Markdown or image file. */
  pagesIndexed: number;
  /** Page images and image files. */
  imagesIndexed: number;
  /** What OpenRouter charged for this indexing (the sum of its requests). */
  cost: number;
  /** Passages, page images and images – none when failed; replaced as a whole. */
  items: AiIndexItem[];
};

export type FileIndexedForAi = {
  type: "EVT-FileIndexedForAi";
  fileId: string;
  owner: FileOwner;
  embeddingModel: string;
  pagesIndexed: number;
  imagesIndexed: number;
  cost: number;
};

export type FileIndexingFailed = {
  type: "EVT-FileIndexingFailed";
  fileId: string;
  owner: FileOwner;
  embeddingModel: string;
  reason: IndexingFailureReason;
};

/**
 * What the background work hands CMD-IndexFileForAi: the file's ID, the model it indexed with and the result. The
 * command's facts read the file in its own transaction – under the removal lock – so its owner is never trusted from
 * the caller and a file removed meanwhile records nothing.
 */
export type IndexFileForAiInput =
  | {
      fileId: string;
      embeddingModel: string;
      result: { items: readonly Omit<AiIndexItem, "id">[]; pagesIndexed: number; imagesIndexed: number; cost: number };
    }
  | { fileId: string; embeddingModel: string; failure: IndexingFailureReason };

/** The file the command's facts read under its removal lock – what the decision copies the owner from. */
export type IndexingFile = { owner: FileOwner };

/** The file was removed (or no longer exists) before the result was stored – nothing is recorded. */
export type IndexFileForAiError = "file-removed";

export function indexFileForAi(
  file: IndexingFile | undefined,
  input: IndexFileForAiInput,
  { clock, newId }: DecisionContext,
): Decision<AiIndexEntryState, FileIndexedForAi | FileIndexingFailed, IndexFileForAiError> {
  if (!file) return { ok: false, error: "file-removed" };
  const owner = file.owner;
  const base = { id: input.fileId, owner, embeddingModel: input.embeddingModel, at: clock.now() };
  if ("failure" in input) {
    const state: AiIndexEntryState = {
      ...base,
      state: "failed",
      failureReason: input.failure,
      pagesIndexed: 0,
      imagesIndexed: 0,
      cost: 0,
      items: [],
    };
    return {
      ok: true,
      state,
      events: [
        {
          type: "EVT-FileIndexingFailed",
          fileId: input.fileId,
          owner,
          embeddingModel: input.embeddingModel,
          reason: input.failure,
        },
      ],
    };
  }
  const state: AiIndexEntryState = {
    ...base,
    state: "indexed",
    pagesIndexed: input.result.pagesIndexed,
    imagesIndexed: input.result.imagesIndexed,
    cost: input.result.cost,
    items: input.result.items.map((item) => ({ ...item, id: newId() })),
  };
  return {
    ok: true,
    state,
    events: [
      {
        type: "EVT-FileIndexedForAi",
        fileId: input.fileId,
        owner,
        embeddingModel: input.embeddingModel,
        pagesIndexed: state.pagesIndexed,
        imagesIndexed: state.imagesIndexed,
        cost: state.cost,
      },
    ],
  };
}

/** CMD-RemoveFileFromAiIndex (POL-RemovedFileLeavesAiIndex): the file's entry and everything of it leaves the index. */
export type RemoveFileFromAiIndexInput = { fileId: string };

export type FileLeftAiIndex = { type: "EVT-FileLeftAiIndex"; fileId: string; owner: FileOwner };

export function removeFileFromAiIndex(entry: AiIndexEntryState): Decision<AiIndexEntryState, FileLeftAiIndex, never> {
  return {
    ok: true,
    state: entry,
    events: [{ type: "EVT-FileLeftAiIndex", fileId: entry.id, owner: entry.owner }],
  };
}

/**
 * CMD-IndexFileForAi run by hand – „Erneut versuchen“ on a file that failed (ST-109): the failed AI index entry is
 * removed and EVT-FileIndexingRetried recorded, so the file is waiting again (derived) and the background work, started
 * after the response, indexes it as the system (user, 2026-11-01). The entry's version is the one the technician's page
 * showed; the rule is decided first, so a page opened while the file had failed explains a change made since.
 */
export type RetryFileIndexingInput = { fileId: string; version: number };

export type FileIndexingRetried = {
  type: "EVT-FileIndexingRetried";
  fileId: string;
  owner: FileOwner;
  embeddingModel: string;
};

/** What the retry must know besides the entry: whether AI is on and with which embedding model. */
export type RetryFileIndexingFacts = { aiOn: boolean; embeddingModel: string | undefined };

/** AI is off – nothing is indexed (user, 2026-10-31); the file is not failed with the current embedding model. */
export type RetryFileIndexingError = "file-indexing-ai-off" | "file-indexing-not-failed";

export function retryFileIndexing(
  entry: AiIndexEntryState,
  input: RetryFileIndexingInput,
  _context: DecisionContext,
  facts: RetryFileIndexingFacts,
): Decision<AiIndexEntryState, FileIndexingRetried, RetryFileIndexingError> {
  if (!facts.aiOn || !facts.embeddingModel) return { ok: false, error: "file-indexing-ai-off" };
  // Only a file that failed with the current embedding model – one of an earlier model is waiting already.
  if (entry.state !== "failed" || entry.embeddingModel !== facts.embeddingModel) {
    return { ok: false, error: "file-indexing-not-failed" };
  }
  return {
    ok: true,
    state: entry,
    events: [
      { type: "EVT-FileIndexingRetried", fileId: input.fileId, owner: entry.owner, embeddingModel: entry.embeddingModel },
    ],
  };
}
