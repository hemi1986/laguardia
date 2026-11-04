import { aggregateCommand } from "@/platform/command";
import { detachFile, detachingActors } from "./detach-file";
import { collectionEvents } from "./events";
import { files } from "./files";

/**
 * CMD-DetachFile through the command layer (ST-115): a changing command on AGG-File, set delta – no version, the row is
 * locked and two detaches run one after the other; detaching what is already detached changes nothing and emits no
 * event. Technicians only. Its result names the target so the page can say what the file was detached from.
 */
export const detachFileCommand = aggregateCommand({
  id: "CMD-DetachFile",
  allowedActors: detachingActors,
  store: files,
  setDelta: true,
  target: (input) => ({ id: input.fileId }),
  decide: detachFile,
  journal: collectionEvents.journal,
  result: (_file, _events, input) => ({ fileId: input.fileId, target: input.target! }),
});
