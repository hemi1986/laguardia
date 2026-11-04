import {
  aiDependencies,
  aiIndexStateOfFile,
  fileIndexingRetriedBy,
  type AiDependencies,
  type IndexingFailureReason,
} from "@/modules/ai-assistance";
import {
  fileDetails,
  fileDetachedIn,
  machineLabels,
  machineModelTitles,
  mayDetachFiles,
  mayRemoveFiles,
  type AttachedTo,
  type FileAttachedTo,
  type FileMediaType,
} from "@/modules/collection";
import { teamMemberNames } from "@/modules/team";
import { isId, lastCommandBy, type Database } from "@/platform/command";
import { teamMessages } from "@/platform/messages";
import { calendarDate, formatCalendarDate } from "@/platform/time";
import { fileSizeText } from "./file-size";
import { targetOf, targetValue } from "./file-attachments";
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
  const wantsConfirmation = params.attached === "1" || typeof params.detached === "string";
  const [names, aiState, origin, retried, detached, lastCommand] = await Promise.all([
    teamMemberNames(db, [details.addedBy]),
    aiIndexStateOfFile(db, ai, fileId),
    originOf(db, params.from, viewer),
    params.retried === "1" ? fileIndexingRetriedBy(db, fileId, viewer.id) : undefined,
    detachedTargetOf(db, params.detached),
    wantsConfirmation ? lastCommandBy(db, { aggregateId: fileId }, viewer.id) : undefined,
  ]);
  const machineCount = details.attachedTo.filter((target) => target.kind === "machine").length;
  const machineModelCount = details.attachedTo.filter((target) => target.kind === "machine-model").length;
  const stillAttached =
    detached !== undefined && details.attachedTo.some((target) => targetValue(target) === targetValue(detached.target));
  const detachedByViewer = lastCommand !== undefined && fileDetachedIn(lastCommand, fileId);
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
    // A resulting-state confirmation (G3, G33): the counts are true whichever command wrote them.
    attachedConfirmation:
      params.attached === "1"
        ? teamMessages.fileDetails.attachedNow(details.title, machineCount, machineModelCount)
        : undefined,
    // Only a technician, and only when the target is no longer attached – or their latest command was this detach. So the
    // sentence never claims a state that is not there, and a helper sees no control and no confirmation (G11, G3).
    detachedConfirmation:
      detached !== undefined && mayDetachFiles(viewer) && (detachedByViewer || !stillAttached)
        ? teamMessages.fileDetails.detachedFrom(details.title, detached.name)
        : undefined,
    removalHref: mayRemoveFiles(viewer) ? removeFileAddress(details.id, origin) : undefined,
    retried: retried?.title,
    origin,
    back: wayBack(origin),
  };
}

/**
 * What a detach named in the address, with the name the confirmation shows (ST-115): a machine by museum number, a
 * machine model by title. None for a malformed value or an ID that is no ID – an address is untrusted input.
 */
async function detachedTargetOf(
  db: Database,
  value: string | string[] | undefined,
): Promise<{ target: AttachedTo; name: string } | undefined> {
  if (typeof value !== "string") return undefined;
  const target = targetOf(value);
  if (!target) return undefined;
  if ("machineId" in target) {
    const label = (await machineLabels(db, [target.machineId])).get(target.machineId);
    return label && { target, name: label.museumNumber };
  }
  const title = (await machineModelTitles(db, [target.machineModelId])).get(target.machineModelId);
  return title ? { target, name: title } : undefined;
}
