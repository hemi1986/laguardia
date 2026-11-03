import { aggregateCommand } from "@/platform/command";
import { addFile, addingActors } from "./add-file";
import { collectionEvents } from "./events";
import { addingFacts, files } from "./files";

/**
 * CMD-AddFile through the command layer: a creating command on AGG-File, emits EVT-FileAdded and one EVT-FileAttached
 * per machine or machine model – in one transaction, so a file is added and attached together or not at all. Any team
 * member. Its facts – whether the machines and machine models it names exist – are read in the same transaction.
 */
export const addFileCommand = aggregateCommand({
  id: "CMD-AddFile",
  allowedActors: addingActors,
  store: files,
  creates: true,
  facts: addingFacts,
  decide: addFile,
  journal: collectionEvents.journal,
  result: (file) => ({ fileId: file.id }),
});
