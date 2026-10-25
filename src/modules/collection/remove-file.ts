import type { ActorOf, Decision, DecisionContext, Role } from "@/platform/command";
import type { FileState } from "./attach-file";

/**
 * CMD-RemoveFile (AGG-File, ST-038): a technician removes a wrong or outdated file. The record of which file was
 * removed, by whom and when is kept; its content is deleted from the storage after the commit – the result names it
 * (user, 2026-09-26: content deleted, record kept). A removed file stays removed (AGG-File).
 */

/** Who may remove a file – technicians only (`docs/product/vision.md`: file deletion is technician-only). */
export const removingActors = ["technician"] as const;

/** The file the technician removes, and the version they saw (HS-16). */
export type RemoveFileInput = { fileId: string; version: number };

export type FileRemoved = {
  type: "EVT-FileRemoved";
  fileId: string;
  machineId?: string;
  machineModelId?: string;
  removedBy: string;
};

export type RemoveFileError = "file-removed";

/**
 * Why a team member may not remove the file – technicians only, never a file already removed. Asked by the decision
 * and by the pages, which offer the action only when there is no reason (G11).
 */
export function removeFileRefusal(
  file: Pick<FileState, "removed">,
  teamMember: { role: Role },
): "not-authorized" | RemoveFileError | undefined {
  if (!removingActors.some((actor) => actor === teamMember.role)) return "not-authorized";
  return file.removed ? "file-removed" : undefined;
}

export function removeFile(
  file: FileState,
  _input: RemoveFileInput,
  { actor, clock }: DecisionContext<ActorOf<(typeof removingActors)[number]>>,
): Decision<FileState, FileRemoved, RemoveFileError> {
  if (file.removed) return { ok: false, error: "file-removed" };
  return {
    ok: true,
    state: { ...file, removed: { by: actor.teamMemberId, at: clock.now() } },
    events: [{ type: "EVT-FileRemoved", fileId: file.id, ...file.owner, removedBy: actor.teamMemberId }],
  };
}
