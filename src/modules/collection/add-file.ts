import type { ActorOf, Decision, DecisionContext } from "@/platform/command";

/**
 * CMD-AddFile (AGG-File, ST-037, ST-113): a team member adds a file – manual, schematic, photo or other – and attaches
 * it to a machine, to its machine model (so every machine of that model shows it), or to both. A file has no owner
 * (ADR 0018): adding it and attaching it are two events, stored together or not at all. The content is already in the
 * private store: the browser uploaded it directly (ST-085, ADR 0009) and the upload module hands it over with its size
 * and media type.
 */

/** The fixed kinds of a file (`CONTEXT.md`, HS-15), in glossary order – the order the machine record groups them in. */
export const fileCategories = ["manual", "schematic", "photo", "other"] as const;
export type FileCategory = (typeof fileCategories)[number];

/** What a form on a machine's page offers to attach a file to: the machine only, or its machine model. */
export const attachTargets = ["machine", "machine-model"] as const;
export type AttachTarget = (typeof attachTargets)[number];

/** Who may add a file – any team member (CMD-AddFile, ACT-TeamMember). */
export const addingActors = ["helper", "technician"] as const;

/** The content of a file: its name in the storage seam, and its size and media type as the store has them. */
export type FileContent = { name: string; size: number; contentType: string };

/** What a file is attached to: one machine, or one machine model (and with it every machine of that model). */
export type AttachedTo = { machineId: string } | { machineModelId: string };

/** An attachment of AGG-File (data model *File*): unique within the file; who made it and when is journal-only. */
export type Attachment = { id: string } & AttachedTo;

/** What the acting person gave (ST-073, Q19): the title as typed; choices are "no value given" when the form had none. */
export type AddFileInput = {
  title: string;
  fileCategory: FileCategory | undefined;
  /** The name the chosen file had on the person's device – typed text; none when the form could not tell. */
  originalFileName: string | undefined;
  /** The machines and machine models the file is attached to – none at all is allowed. */
  machineIds: readonly string[];
  machineModelIds: readonly string[];
  /** None when the form had nothing to add – a camera photo form sent without a photo (ST-054). */
  content: FileContent | undefined;
};

/** AGG-File – current state (`docs/architecture/data-model.md`): a file on its own, with its attachments. */
export type FileState = {
  id: string;
  title: string;
  fileCategory: FileCategory;
  originalFileName?: string;
  content: FileContent;
  attachments: Attachment[];
  addedBy: string;
  addedAt: Date;
  /** Who removed it and when (ST-038) – a removed file stays removed, and its content is gone from the storage. */
  removed?: { by: string; at: Date };
};

export type FileAdded = {
  type: "EVT-FileAdded";
  fileId: string;
  title: string;
  fileCategory: FileCategory;
  addedBy: string;
};

/** One event per machine or machine model the file is attached to (data model *File*, EVT-FileAttached). */
export type FileAttached = { type: "EVT-FileAttached"; fileId: string; attachedBy: string } & (
  { machineId: string; machineModelId?: undefined } | { machineModelId: string; machineId?: undefined }
);

/** What the decision must know: whether every machine and machine model the input names exists. */
export type AddingFacts = { everythingExists: boolean };

/** The rules that need nothing but the input – the form asks them before it hands the uploaded content over. */
export type AddFileInputError = "title-required" | "file-category-required";
export type AddFileError = AddFileInputError | "file-required" | "unknown-machine" | "unknown-machine-model";

/**
 * Why the input cannot be added as it is – the rules that need nothing but the input. The decision applies them first;
 * the form asks them before it hands the uploaded content over, so a missing title keeps the chosen file (ST-085 #9).
 */
export function addFileRefusal(input: Pick<AddFileInput, "title" | "fileCategory">): AddFileInputError | undefined {
  if (!input.title.trim()) return "title-required";
  if (!input.fileCategory) return "file-category-required";
  return undefined;
}

export function addFile(
  facts: AddingFacts,
  input: AddFileInput,
  { actor, clock, newId }: DecisionContext<ActorOf<(typeof addingActors)[number]>>,
): Decision<FileState, FileAdded | FileAttached, AddFileError> {
  const refusal = addFileRefusal(input);
  if (refusal) return { ok: false, error: refusal };
  if (!input.content) return { ok: false, error: "file-required" };
  if (!facts.everythingExists)
    return { ok: false, error: input.machineIds.length > 0 ? "unknown-machine" : "unknown-machine-model" };
  const targets: AttachedTo[] = [
    ...[...new Set(input.machineIds)].map((machineId) => ({ machineId })),
    ...[...new Set(input.machineModelIds)].map((machineModelId) => ({ machineModelId })),
  ];
  const file: FileState = {
    id: newId(),
    title: input.title.trim(),
    fileCategory: input.fileCategory!,
    ...(input.originalFileName?.trim() && { originalFileName: input.originalFileName.trim() }),
    content: input.content,
    attachments: targets.map((target) => ({ id: newId(), ...target })),
    addedBy: actor.teamMemberId,
    addedAt: clock.now(),
  };
  return {
    ok: true,
    state: file,
    events: [
      {
        type: "EVT-FileAdded",
        fileId: file.id,
        title: file.title,
        fileCategory: file.fileCategory,
        addedBy: file.addedBy,
      },
      ...targets.map((target): FileAttached => ({
        type: "EVT-FileAttached",
        fileId: file.id,
        attachedBy: actor.teamMemberId,
        ...("machineId" in target ? { machineId: target.machineId } : { machineModelId: target.machineModelId }),
      })),
    ],
  };
}
