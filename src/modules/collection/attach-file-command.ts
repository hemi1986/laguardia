import { aggregateCommand } from "@/platform/command";
import { attachFile, attachingActors } from "./attach-file";
import { collectionEvents } from "./events";
import { attachingFacts, files } from "./files";

/**
 * CMD-AttachFile through the command layer (ST-115): a changing command on AGG-File, set delta – no version, the row is
 * locked and two attaches run one after the other; attaching what is already attached changes nothing and emits no
 * event. Any team member. Its facts check the machines and machine models in the same transaction; a retired machine is
 * allowed and no retirement lock is taken (data model *File*, *Retired machine*).
 */
export const attachFileCommand = aggregateCommand({
  id: "CMD-AttachFile",
  allowedActors: attachingActors,
  store: files,
  setDelta: true,
  target: (input) => ({ id: input.fileId }),
  facts: attachingFacts,
  decide: attachFile,
  journal: collectionEvents.journal,
  result: (file) => ({ fileId: file.id }),
});
