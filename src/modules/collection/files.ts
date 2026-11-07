import { inArray } from "drizzle-orm";
import { aggregateStore, isId, replaces, type Database } from "@/platform/command";
import type { AddFileInput, AddingFacts, Attachment, FileState } from "./add-file";
import type { AttachFileInput, AttachingFacts } from "./attach-file";
import { file, fileAttachment, machine, machineModel } from "./schema";

/** The attachments of a file (ST-113): saved with the file as a whole, in the order they were made. */
const attachments = replaces({
  table: fileAttachment,
  owner: "fileId",
  toEntry: (row): Attachment =>
    row.machineId ? { id: row.id, machineId: row.machineId } : { id: row.id, machineModelId: row.machineModelId! },
  toRow: (attachment) => ({
    id: attachment.id,
    machineId: "machineId" in attachment ? attachment.machineId : null,
    machineModelId: "machineModelId" in attachment ? attachment.machineModelId : null,
  }),
});

/** How AGG-File is stored: one row per file, and its attachments – each to a machine or to a machine model. */
export const files = aggregateStore({
  type: "AGG-File",
  table: file,
  replaces: { attachments },
  toState: (row, lists): FileState => ({
    id: row.id,
    title: row.title,
    fileCategory: row.fileCategory,
    ...(row.originalFileName && { originalFileName: row.originalFileName }),
    content: { name: row.content, size: row.size, contentType: row.contentType },
    attachments: lists.attachments,
    addedBy: row.addedBy,
    addedAt: row.addedAt,
    ...(row.removedBy && row.removedAt && { removed: { by: row.removedBy, at: row.removedAt } }),
  }),
  toRow: (state: FileState) => ({
    id: state.id,
    title: state.title,
    fileCategory: state.fileCategory,
    originalFileName: state.originalFileName ?? null,
    content: state.content.name,
    size: state.content.size,
    contentType: state.content.contentType,
    addedBy: state.addedBy,
    addedAt: state.addedAt,
    removedBy: state.removed?.by ?? null,
    removedAt: state.removed?.at ?? null,
  }),
});

/** Whether every machine and machine model the input names exists – CMD-AddFile's and CMD-AttachFile's one rule. */
async function targetsExist(
  tx: Database,
  machineIds: readonly string[],
  machineModelIds: readonly string[],
): Promise<{ machinesExist: boolean; machineModelsExist: boolean }> {
  const machines = [...new Set(machineIds)];
  const models = [...new Set(machineModelIds)];
  // An ID that is no ID names nothing – a forged form field, not a database error.
  if (![...machines, ...models].every(isId)) return { machinesExist: false, machineModelsExist: false };
  const [foundMachines, foundModels] = await Promise.all([
    machines.length ? tx.select({ id: machine.id }).from(machine).where(inArray(machine.id, machines)) : [],
    models.length ? tx.select({ id: machineModel.id }).from(machineModel).where(inArray(machineModel.id, models)) : [],
  ]);
  return {
    machinesExist: foundMachines.length === machines.length,
    machineModelsExist: foundModels.length === models.length,
  };
}

/** CMD-AddFile's facts: whether every machine and machine model the input names exists. */
export async function addingFacts(tx: Database, input: AddFileInput): Promise<AddingFacts> {
  const { machinesExist, machineModelsExist } = await targetsExist(tx, input.machineIds, input.machineModelIds);
  return { everythingExists: machinesExist && machineModelsExist };
}

/** CMD-AttachFile's facts (ST-115): which of the named machines and machine models does not exist – retired machines included. */
export async function attachingFacts(tx: Database, input: AttachFileInput): Promise<AttachingFacts> {
  const { machinesExist, machineModelsExist } = await targetsExist(tx, input.machineIds, input.machineModelIds);
  return { missingMachines: !machinesExist, missingMachineModels: !machineModelsExist };
}
