import { aggregateCommand, type ActorOf, type DecisionContext } from "@/platform/command";
import type { FileState } from "./attach-file";
import { collectionEvents } from "./events";
import { fileRemovalLock } from "./file-removal-lock";
import { files } from "./files";
import { removeFile, removingActors, type RemoveFileInput } from "./remove-file";

/** What the command's facts hand the decision: the file's removal lock is now held until the commit (ADR 0014). */
type RemovingFacts = { locked: true };

/**
 * The removal's decision – CMD-RemoveFile's pure rule, with the facts giving nothing but the lock.
 */
function decideRemoval(
  file: FileState,
  input: RemoveFileInput,
  context: DecisionContext<ActorOf<(typeof removingActors)[number]>>,
  facts: RemovingFacts,
) {
  void facts;
  return removeFile(file, input, context);
}

/**
 * CMD-RemoveFile through the command layer: a changing command on AGG-File, at the version the technician saw; emits
 * EVT-FileRemoved. Technicians only. Its result names the removed content, which the runner deletes from the storage
 * after the commit (ADR 0009: deleting content only for a deliberate removal). Before it decides, it takes the file's
 * removal lock exclusively (ADR 0014), so an indexing that is still running cannot bring the file back into the AI
 * index (ST-106).
 */
export const removeFileCommand = aggregateCommand({
  id: "CMD-RemoveFile",
  allowedActors: removingActors,
  store: files,
  target: (input) => ({ id: input.fileId, version: input.version }),
  facts: async (tx, input): Promise<RemovingFacts> => {
    await fileRemovalLock(tx, input.fileId, "exclusive");
    return { locked: true };
  },
  decide: decideRemoval,
  journal: collectionEvents.journal,
  result: (file) => ({ removedContent: file.content.name }),
  removesContent: ({ removedContent }) => removedContent,
});
