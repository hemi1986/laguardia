import type { ActorOf, Decision, DecisionContext } from "@/platform/command";
import type { Attachment, AttachedTo, FileAttached, FileState } from "./add-file";

/**
 * CMD-AttachFile (AGG-File, ST-115): a team member attaches an existing file to further machines and machine models, from
 * its file details. What the file is already attached to is nothing to do – the command is a set delta and names no
 * version, so two people attaching it at the same moment both stand (data model *File*, *Concurrency*).
 */

/** Who may attach a file – any team member (CMD-AttachFile, ACT-TeamMember). */
export const attachingActors = ["helper", "technician"] as const;

/** The file to attach and what to attach it to – none at all is a rejection. */
export type AttachFileInput = {
  fileId: string;
  machineIds: readonly string[];
  machineModelIds: readonly string[];
};

/** What the decision must know: which of the named machines and machine models do not exist. Retired machines are allowed. */
export type AttachingFacts = { missingMachines: boolean; missingMachineModels: boolean };

export type AttachFileError = "file-removed" | "no-attachment-chosen" | "unknown-machine" | "unknown-machine-model";

/**
 * The one place that says what a target is called in a set of attachments – the command's decision and the read model
 * compare machines and machine models without mixing them up.
 */
export function targetKey(target: AttachedTo): string {
  return "machineId" in target ? `machine:${target.machineId}` : `machineModel:${target.machineModelId}`;
}

/**
 * Attaches the chosen machines and machine models the file is not attached to yet – one EVT-FileAttached per new
 * attachment, machines first, then machine models, in the order posted. Nothing new is nothing to do: the loaded state
 * comes back without an event and the version stays (set delta). A removed file rejects the whole command.
 */
export function attachFile(
  file: FileState,
  input: AttachFileInput,
  { actor, newId }: DecisionContext<ActorOf<(typeof attachingActors)[number]>>,
  facts: AttachingFacts,
): Decision<FileState, FileAttached, AttachFileError> {
  if (file.removed) return { ok: false, error: "file-removed" };
  const machineIds = [...new Set(input.machineIds)];
  const machineModelIds = [...new Set(input.machineModelIds)];
  if (machineIds.length === 0 && machineModelIds.length === 0) return { ok: false, error: "no-attachment-chosen" };
  if (facts.missingMachines) return { ok: false, error: "unknown-machine" };
  if (facts.missingMachineModels) return { ok: false, error: "unknown-machine-model" };
  const attached = new Set(file.attachments.map(targetKey));
  const targets: AttachedTo[] = [
    ...machineIds.filter((machineId) => !attached.has(`machine:${machineId}`)).map((machineId) => ({ machineId })),
    ...machineModelIds
      .filter((machineModelId) => !attached.has(`machineModel:${machineModelId}`))
      .map((machineModelId) => ({ machineModelId })),
  ];
  if (targets.length === 0) return { ok: true, state: file, events: [] };
  const attachments: Attachment[] = [...file.attachments, ...targets.map((target) => ({ id: newId(), ...target }))];
  return {
    ok: true,
    state: { ...file, attachments },
    events: targets.map((target): FileAttached => ({
      type: "EVT-FileAttached",
      fileId: file.id,
      attachedBy: actor.teamMemberId,
      ...target,
    })),
  };
}
