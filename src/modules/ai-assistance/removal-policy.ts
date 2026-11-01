import { aggregateCommand, policy, trigger, withPolicies } from "@/platform/command";
import { removeFileCommand } from "@/modules/collection";
import { removeFileFromAiIndex } from "./ai-index-entry";
import { aiIndexEntries, hasAiIndexEntry } from "./ai-index-entries";
import { aiAssistanceEvents } from "./events";

/**
 * POL-RemovedFileLeavesAiIndex (HS-29, ST-106): a removed file leaves the AI index in the same transaction as its
 * removal – also while AI is off. AI assistance adds the policy to Collection's CMD-RemoveFile (ADR 0010) and exports
 * the composed command, which the file pages use; Collection names no AI. The file's removal lock, which Collection's
 * command takes exclusively, serialises this with an indexing that is still running (ADR 0014).
 */
export const removeFileFromAiIndexCommand = aggregateCommand({
  id: "CMD-RemoveFileFromAiIndex",
  allowedActors: ["system"],
  store: aiIndexEntries,
  // A policy names no version nobody saw; the entry is not shown to a person, so the row lock is enough.
  target: (input: { fileId: string }) => ({ id: input.fileId }),
  decide: removeFileFromAiIndex,
  removes: () => true,
  journal: aiAssistanceEvents.journal,
  result: () => ({}),
});

export const removedFileLeavesAiIndex = policy({
  id: "POL-RemovedFileLeavesAiIndex",
  async calls(tx, { events }) {
    const calls = [];
    for (const event of events) {
      if (event.type !== "EVT-FileRemoved") continue;
      // A file without an entry records nothing – only a real removal of something in the index is an event.
      if (await hasAiIndexEntry(tx, event.aggregate.id)) {
        calls.push(trigger(removeFileFromAiIndexCommand, { fileId: event.aggregate.id }));
      }
    }
    return calls;
  },
});

/** Collection's CMD-RemoveFile with POL-RemovedFileLeavesAiIndex added – what the file pages run (ST-106). */
export const removeFileCommandWithAiIndex = withPolicies(removeFileCommand, [removedFileLeavesAiIndex]);
