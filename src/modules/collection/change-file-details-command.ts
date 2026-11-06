import { aggregateCommand } from "@/platform/command";
import { changeFileDetails, changingActors } from "./change-file-details";
import { collectionEvents } from "./events";
import { files } from "./files";

/**
 * CMD-ChangeFileDetails through the command layer (ST-116): a changing command on AGG-File at the version the team
 * member saw; emits EVT-FileDetailsChanged. Any team member. Sent unchanged it ends successfully without an event and
 * the version stays – no version check either, since nothing is written (G33). A real attach or detach raises the
 * version as well, so a correction after one is rejected once – rare and harmless (data model).
 */
export const changeFileDetailsCommand = aggregateCommand({
  id: "CMD-ChangeFileDetails",
  allowedActors: changingActors,
  store: files,
  mayChangeNothing: true,
  target: (input) => ({ id: input.fileId, version: input.version }),
  decide: changeFileDetails,
  journal: collectionEvents.journal,
  result: (file) => ({ fileId: file.id, title: file.title }),
});
