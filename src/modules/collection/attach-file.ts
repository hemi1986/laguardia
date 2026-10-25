import type { ActorOf, Decision, DecisionContext } from "@/platform/command";

/**
 * CMD-AttachFile (AGG-File, ST-037): a team member attaches a file – manual, schematic, photo or other – to a machine
 * or to its machine model, so every machine of that model shows it. The content is already in the private store: the
 * browser uploaded it directly (ST-085, ADR 0009) and the upload module hands it over with its size and media type.
 */

/** The fixed kinds of a file (`CONTEXT.md`, HS-15), in glossary order – the order the machine record groups them in. */
export const fileCategories = ["manual", "schematic", "photo", "other"] as const;
export type FileCategory = (typeof fileCategories)[number];

/** Who a file is attached to, seen from the machine whose page the form is on: the machine, or its machine model. */
export const attachTargets = ["machine", "machine-model"] as const;
export type AttachTarget = (typeof attachTargets)[number];

/** Who may attach a file – any team member (CMD-AttachFile, ACT-TeamMember). */
export const attachingActors = ["helper", "technician"] as const;

/** The content of a file: its name in the storage seam, and its size and media type as the store has them. */
export type FileContent = { name: string; size: number; contentType: string };

/** What the acting person gave (ST-073, Q19): the title as typed; choices are "no value given" when the form had none. */
export type AttachFileInput = {
  /** The machine whose page the form is on – the file goes to it or to its machine model. */
  machineId: string;
  attachTo: AttachTarget | undefined;
  title: string;
  fileCategory: FileCategory | undefined;
  /** None when the form had nothing to attach – a camera photo form sent without a photo (ST-054). */
  content: FileContent | undefined;
};

/** AGG-File – current state (`docs/architecture/data-model.md`): attached to exactly one machine or machine model. */
export type FileState = {
  id: string;
  owner: { machineId: string } | { machineModelId: string };
  title: string;
  fileCategory: FileCategory;
  content: FileContent;
  attachedBy: string;
  attachedAt: Date;
  /** Who removed it and when (ST-038) – a removed file stays removed, and its content is gone from the storage. */
  removed?: { by: string; at: Date };
};

export type FileAttached = {
  type: "EVT-FileAttached";
  fileId: string;
  machineId?: string;
  machineModelId?: string;
  title: string;
  fileCategory: FileCategory;
  attachedBy: string;
};

/** What the decision must know: the machine model of the machine whose page the form is on – none if it is unknown. */
export type AttachingFacts = { machineModelId: string } | undefined;

/** The form's own rejections – checked before uploaded content is handed over, so they never delete it (ST-085 #9). */
export type AttachFileInputError = "title-required" | "file-category-required" | "attach-to-required";
export type AttachFileError = AttachFileInputError | "file-required" | "unknown-machine";

/**
 * Why the input cannot be attached as it is – the rules that need nothing but the input. The decision applies them
 * first; the form asks them before it hands the uploaded content over, so a missing title keeps the chosen file.
 */
export function attachFileRefusal(
  input: Pick<AttachFileInput, "title" | "fileCategory" | "attachTo">,
): AttachFileInputError | undefined {
  if (!input.title.trim()) return "title-required";
  if (!input.fileCategory) return "file-category-required";
  if (!input.attachTo) return "attach-to-required";
  return undefined;
}

export function attachFile(
  facts: AttachingFacts,
  input: AttachFileInput,
  { actor, clock, newId }: DecisionContext<ActorOf<(typeof attachingActors)[number]>>,
): Decision<FileState, FileAttached, AttachFileError> {
  const refusal = attachFileRefusal(input);
  if (refusal) return { ok: false, error: refusal };
  if (!input.content) return { ok: false, error: "file-required" };
  if (!facts) return { ok: false, error: "unknown-machine" };
  const owner =
    input.attachTo === "machine-model" ? { machineModelId: facts.machineModelId } : { machineId: input.machineId };
  const file: FileState = {
    id: newId(),
    owner,
    title: input.title.trim(),
    fileCategory: input.fileCategory!,
    content: input.content,
    attachedBy: actor.teamMemberId,
    attachedAt: clock.now(),
  };
  return {
    ok: true,
    state: file,
    events: [
      {
        type: "EVT-FileAttached",
        fileId: file.id,
        ...owner,
        title: file.title,
        fileCategory: file.fileCategory,
        attachedBy: file.attachedBy,
      },
    ],
  };
}
