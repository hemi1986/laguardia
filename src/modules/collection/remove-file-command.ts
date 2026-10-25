import { aggregateCommand } from "@/platform/command";
import { collectionEvents } from "./events";
import { files } from "./files";
import { removeFile, removingActors } from "./remove-file";

/**
 * CMD-RemoveFile through the command layer: a changing command on AGG-File, at the version the technician saw; emits
 * EVT-FileRemoved. Technicians only. Its result names the removed content, which the runner deletes from the storage
 * after the commit (ADR 0009: deleting content only for a deliberate removal).
 */
export const removeFileCommand = aggregateCommand({
  id: "CMD-RemoveFile",
  allowedActors: removingActors,
  store: files,
  target: (input) => ({ id: input.fileId, version: input.version }),
  decide: removeFile,
  journal: collectionEvents.journal,
  result: (file) => ({ removedContent: file.content.name }),
  removesContent: ({ removedContent }) => removedContent,
});
