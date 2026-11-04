import {
  aiDependencies,
  aiIndexStateOfFile,
  fileIndexingRetriedBy,
  type AiDependencies,
  type IndexingFailureReason,
} from "@/modules/ai-assistance";
import {
  fileDetails,
  machineLabels,
  machineModelTitles,
  mayDetachFiles,
  mayRemoveFiles,
  type FileAttachedTo,
  type FileMediaType,
} from "@/modules/collection";
import { teamMemberNames } from "@/modules/team";
import type { Database } from "@/platform/command";
import { isId } from "@/platform/command";
import { teamMessages } from "@/platform/messages";
import { calendarDate, formatCalendarDate } from "@/platform/time";
import { fileSizeText } from "./file-size";
import { attachToFileAddress, originOf, removeFileAddress, wayBack, type FileOrigin } from "./file-origin";

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
  /** „Anhängen“ at the end of „Angehängt an“ (ST-115) – every team member. */
  attachHref: string;
  /** „Lösen“ on each entry (ST-115) – technicians only (G11). */
  detachOffered: boolean;
  /** The confirmation after attaching (ST-115, G3, G33): the resulting state, never from the journal alone. */
  attachedConfirmation: string | undefined;
  /** The confirmation after detaching one thing (ST-115, G3), with the target's name. */
  detachedConfirmation: string | undefined;
  /** „Datei entfernen“ is offered – technicians only (G11), with the origin kept (ST-121). */
  removalHref: string | undefined;
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
  const [names, aiState, origin, retried, detachedName] = await Promise.all([
    teamMemberNames(db, [details.addedBy]),
    aiIndexStateOfFile(db, ai, fileId),
    originOf(db, params.from, viewer),
    params.retried === "1" ? fileIndexingRetriedBy(db, fileId, viewer.id) : undefined,
    detachedNameOf(db, params.detached),
  ]);
  const machineCount = details.attachedTo.filter((target) => target.kind === "machine").length;
  const machineModelCount = details.attachedTo.filter((target) => target.kind === "machine-model").length;
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
    attachHref: attachToFileAddress(details.id, origin),
    detachOffered: mayDetachFiles(viewer),
    attachedConfirmation:
      params.attached === "1"
        ? teamMessages.fileDetails.attachedNow(details.title, machineCount, machineModelCount)
        : undefined,
    detachedConfirmation: detachedName ? teamMessages.fileDetails.detachedFrom(details.title, detachedName) : undefined,
    removalHref: mayRemoveFiles(viewer) ? removeFileAddress(details.id, origin) : undefined,
    retried: retried?.title,
    origin,
    back: wayBack(origin),
  };
}

/** The name of what a detach named in the address – a machine by museum number, a machine model by title (ST-115). */
async function detachedNameOf(db: Database, value: string | string[] | undefined): Promise<string | undefined> {
  if (typeof value !== "string") return undefined;
  const separator = value.indexOf(":");
  if (separator < 0) return undefined;
  const kind = value.slice(0, separator);
  const id = value.slice(separator + 1);
  if (!id) return undefined;
  if (kind === "machine") return (await machineLabels(db, [id])).get(id)?.museumNumber;
  if (kind === "machineModel") return (await machineModelTitles(db, [id])).get(id);
  return undefined;
}
