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
 * What the background work hands CMD-IndexFileForAi: the file and its result. The owner is copied from Collection's
 * file when it is read; the command's transaction checks again that the file is not removed (the removal lock).
 */
export type IndexFileForAiInput =
  | {
      fileId: string;
      owner: FileOwner;
      embeddingModel: string;
      result: { items: readonly Omit<AiIndexItem, "id">[]; pagesIndexed: number; imagesIndexed: number; cost: number };
    }
  | { fileId: string; owner: FileOwner; embeddingModel: string; failure: IndexingFailureReason };

export function indexFileForAi(
  _nothingYet: undefined,
  input: IndexFileForAiInput,
  { clock, newId }: DecisionContext,
): Decision<AiIndexEntryState, FileIndexedForAi | FileIndexingFailed, never> {
  const base = { id: input.fileId, owner: input.owner, embeddingModel: input.embeddingModel, at: clock.now() };
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
          owner: input.owner,
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
        owner: input.owner,
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
