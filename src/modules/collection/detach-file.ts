import type { ActorOf, Decision, DecisionContext, Role } from "@/platform/command";
import type { AttachedTo, FileState } from "./add-file";
import { targetKey } from "./attach-file";

/**
 * CMD-DetachFile (AGG-File, ST-115): a technician detaches a file from one machine or machine model in one tap – no
 * question, because attaching it again undoes it (G10a). A set delta: detaching what is already detached is nothing to
 * do, and a real change raises the file's version. A removed file rejects it.
 */

/** Who may detach a file – technicians only (CMD-DetachFile, ACT-Technician). */
export const detachingActors = ["technician"] as const;

/** Whether the team member may detach files at all – what the file details ask before they offer „Lösen“ (ST-115, G11). */
export function mayDetachFiles(teamMember: { role: Role }): boolean {
  return detachingActors.some((actor) => actor === teamMember.role);
}

/** The file and the one thing it is detached from. */
export type DetachFileInput = { fileId: string; target: AttachedTo | undefined };

export type FileDetached = { type: "EVT-FileDetached"; fileId: string; detachedBy: string } & AttachedTo;

export type DetachFileError = "file-removed" | "target-required";

/**
 * Removes the attachment to the target, if it is there. Nothing attached is nothing to do: the loaded state comes back
 * without an event and the version stays (set delta). A target that is none – a forged form – is refused like an unknown
 * machine, and a removed file rejects the whole command.
 */
export function detachFile(
  file: FileState,
  input: DetachFileInput,
  { actor }: DecisionContext<ActorOf<(typeof detachingActors)[number]>>,
): Decision<FileState, FileDetached, DetachFileError> {
  if (file.removed) return { ok: false, error: "file-removed" };
  if (!input.target) return { ok: false, error: "target-required" };
  const key = targetKey(input.target);
  const remaining = file.attachments.filter((attachment) => targetKey(attachment) !== key);
  if (remaining.length === file.attachments.length) return { ok: true, state: file, events: [] };
  return {
    ok: true,
    state: { ...file, attachments: remaining },
    events: [
      {
        type: "EVT-FileDetached",
        fileId: file.id,
        detachedBy: actor.teamMemberId,
        ...input.target,
      },
    ],
  };
}
