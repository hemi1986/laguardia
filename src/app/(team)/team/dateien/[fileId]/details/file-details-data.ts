import {
  aiDependencies,
  aiIndexStateOfFile,
  fileIndexingRetriedBy,
  type AiDependencies,
  type IndexingFailureReason,
} from "@/modules/ai-assistance";
import { fileDetails, type FileAttachedTo, type FileMediaType } from "@/modules/collection";
import { teamMemberNames } from "@/modules/team";
import type { Database } from "@/platform/command";
import { isId } from "@/platform/command";
import { teamMessages } from "@/platform/messages";
import { calendarDate, formatCalendarDate } from "@/platform/time";
import { fileSizeText } from "./file-size";
import { originOf, wayBack, type FileOrigin } from "./file-origin";

/** Section „KI-Erfassung“ (RM-FileDetails, G37): none while AI is off. */
export type FileAiState =
  { state: "indexed" } | { state: "waiting" } | { state: "failed"; reason: IndexingFailureReason; version: number };

export type FileDetailsData = {
  id: string;
  title: string;
  category: string;
  mediaType: FileMediaType;
  size: string;
  addedBy: string;
  addedOn: string;
  attachedTo: FileAttachedTo[];
  ai: FileAiState | undefined;
  /** „Erneut versuchen“ is offered – only a technician, only on a failed file (AI is on then). */
  retryOffered: boolean;
  /** The title of the file the viewer just tried again (G3) – from the journal, never from the address alone. */
  retried: string | undefined;
  /** The origin the address named, checked – what the actions hand on. */
  origin: FileOrigin;
  back: ReturnType<typeof wayBack>;
};

/**
 * The file details page's data (RM-FileDetails, ST-114): Collection's file, AI assistance's state and Team's name of
 * *Added by* – the page composes (ST-009). None for an unknown or removed file. Reading it starts no run (HS-33, HS-35
 * name only the defect page and the form „KI“).
 */
export async function loadFileDetails(
  db: Database,
  fileId: string,
  {
    params,
    viewer,
    ai = aiDependencies(),
  }: {
    params: Record<string, string | string[] | undefined>;
    viewer: { id: string; role: "helper" | "technician" };
    ai?: Pick<AiDependencies, "encryptionKey">;
  },
): Promise<FileDetailsData | undefined> {
  if (!isId(fileId)) return undefined;
  const details = await fileDetails(db, fileId);
  if (!details) return undefined;
  const [names, aiState, origin, retried] = await Promise.all([
    teamMemberNames(db, [details.addedBy]),
    aiIndexStateOfFile(db, ai, fileId),
    originOf(db, params.from, viewer),
    params.retried === "1" ? fileIndexingRetriedBy(db, fileId, viewer.id) : undefined,
  ]);
  return {
    id: details.id,
    title: details.title,
    category: teamMessages.fileCategories[details.fileCategory],
    mediaType: details.mediaType,
    size: fileSizeText(details.size),
    addedBy: names.get(details.addedBy) ?? teamMessages.names.unknownTeamMember,
    addedOn: formatCalendarDate(calendarDate(details.addedAt)),
    attachedTo: details.attachedTo,
    ai: aiState,
    retryOffered: viewer.role === "technician" && aiState?.state === "failed",
    retried: retried?.title,
    origin,
    back: wayBack(origin),
  };
}
