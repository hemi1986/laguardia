import { aggregateCommand } from "@/platform/command";
import { attachFile, attachingActors } from "./attach-file";
import { collectionEvents } from "./events";
import { attachingFacts, files } from "./files";

/**
 * CMD-AttachFile through the command layer: a creating command on AGG-File, emits EVT-FileAttached. Any team member.
 * Its facts – the machine model of the machine whose page the form is on – are read in the same transaction.
 */
export const attachFileCommand = aggregateCommand({
  id: "CMD-AttachFile",
  allowedActors: attachingActors,
  store: files,
  creates: true,
  facts: attachingFacts,
  decide: attachFile,
  journal: collectionEvents.journal,
  result: (file) => ({ fileId: file.id }),
});
