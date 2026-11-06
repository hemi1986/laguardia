import type { ActorOf, Decision, DecisionContext } from "@/platform/command";
import { addFileRefusal, type AddFileInputError, type FileCategory, type FileState } from "./add-file";

/**
 * CMD-ChangeFileDetails (AGG-File, ST-116): a team member corrects a file's title and file category – a mistyped manual
 * is found under the right name in the right group. Neither the original file name nor the content can change: for
 * other content, add the new file and remove the old one. Sent unchanged it lands like a save and records nothing (G33).
 */

/** Who may correct a file – any team member (CMD-ChangeFileDetails, ACT-TeamMember). */
export const changingActors = ["helper", "technician"] as const;

/** The whole form, with the version of the file the person saw (HS-16); no file category is "no value given". */
export type ChangeFileDetailsInput = {
  fileId: string;
  title: string;
  fileCategory: FileCategory | undefined;
  version: number;
};

/** Which details a correction changed – the journal names them, never the typed title (events.yaml). */
export type ChangedFileDetail = "title" | "fileCategory";

export type FileDetailsChanged = {
  type: "EVT-FileDetailsChanged";
  fileId: string;
  changedDetails: ChangedFileDetail[];
  fileCategory: FileCategory;
  changedBy: string;
};

export type ChangeFileDetailsError = AddFileInputError | "file-removed";

/**
 * Corrects the details the input changes. A removed file cannot be changed (AGG-File); a title and a file category are
 * required. Nothing changed is nothing to do: the loaded state comes back without an event and the version stays.
 */
export function changeFileDetails(
  file: FileState,
  input: ChangeFileDetailsInput,
  { actor }: DecisionContext<ActorOf<(typeof changingActors)[number]>>,
): Decision<FileState, FileDetailsChanged, ChangeFileDetailsError> {
  if (file.removed) return { ok: false, error: "file-removed" };
  const refusal = addFileRefusal(input);
  if (refusal) return { ok: false, error: refusal };
  const title = input.title.trim();
  const fileCategory = input.fileCategory!;
  const changedDetails: ChangedFileDetail[] = [
    ...(title !== file.title ? (["title"] as const) : []),
    ...(fileCategory !== file.fileCategory ? (["fileCategory"] as const) : []),
  ];
  if (changedDetails.length === 0) return { ok: true, state: file, events: [] };
  return {
    ok: true,
    state: { ...file, title, fileCategory },
    events: [
      { type: "EVT-FileDetailsChanged", fileId: file.id, changedDetails, fileCategory, changedBy: actor.teamMemberId },
    ],
  };
}
