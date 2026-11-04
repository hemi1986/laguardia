import { eq } from "drizzle-orm";
import { isId, type Database } from "@/platform/command";
import type { MachineCategory, Technology } from "./create-machine-model";
import { groupMachineModels, groupMachines, type MachineGroup, type MachineModelGroup } from "./machine-groups";
import { file, fileAttachment, machine, machineModel } from "./schema";

/** A machine a file can still be attached to (RM-AttachmentChoice, ST-115) – retired machines included. */
export type AttachmentChoiceMachine = {
  id: string;
  museumNumber: string;
  machineModelTitle: string;
  retired: boolean;
  machineCategory: MachineCategory;
  technology: Technology | undefined;
};

/** A machine model a file can still be attached to (RM-AttachmentChoice, ST-115). */
export type AttachmentChoiceMachineModel = {
  id: string;
  title: string;
  machineCategory: MachineCategory;
  technology: Technology | undefined;
};

/** The choice on „Anhängen“ (RM-AttachmentChoice, ST-115): „Geräte“ and „Modelle“, each grouped by machine category and technology. */
export type AttachmentChoice = {
  title: string;
  /** A removed file has nothing to attach – the form still names it and says that it is gone. */
  removed: boolean;
  /** Only what the file is not attached to yet, in each group the active machines by museum number, then the retired ones. */
  machineGroups: MachineGroup<AttachmentChoiceMachine>[];
  /** Only the machine models the file is not attached to yet, by title. */
  machineModelGroups: MachineModelGroup<AttachmentChoiceMachineModel>[];
};

/**
 * What a file can still be attached to (RM-AttachmentChoice, ST-115): the machines and machine models it is not attached
 * to yet – a machine of an attached machine model stays offered, it is a different thing to be attached to. Retired
 * machines are offered too, at the end of their group. None for an unknown file; a removed file answers with nothing to
 * choose and `removed` (the form says so). Only after the team page's access check (files are team-only).
 */
export async function attachmentChoice(db: Database, fileId: string): Promise<AttachmentChoice | undefined> {
  if (!isId(fileId)) return undefined;
  const [row] = await db.select({ title: file.title, removedAt: file.removedAt }).from(file).where(eq(file.id, fileId));
  if (!row) return undefined;
  if (row.removedAt) return { title: row.title, removed: true, machineGroups: [], machineModelGroups: [] };
  const attached = await db
    .select({ machineId: fileAttachment.machineId, machineModelId: fileAttachment.machineModelId })
    .from(fileAttachment)
    .where(eq(fileAttachment.fileId, fileId));
  const attachedMachines = new Set(attached.flatMap((entry) => (entry.machineId ? [entry.machineId] : [])));
  const attachedModels = new Set(attached.flatMap((entry) => (entry.machineModelId ? [entry.machineModelId] : [])));
  const [machines, models] = await Promise.all([
    db
      .select({
        id: machine.id,
        museumNumber: machine.museumNumber,
        machineModelTitle: machineModel.title,
        retiredAt: machine.retiredAt,
        machineCategory: machineModel.machineCategory,
        technology: machineModel.technology,
      })
      .from(machine)
      .innerJoin(machineModel, eq(machineModel.id, machine.machineModelId)),
    db
      .select({
        id: machineModel.id,
        title: machineModel.title,
        machineCategory: machineModel.machineCategory,
        technology: machineModel.technology,
      })
      .from(machineModel),
  ]);
  const offeredMachines: AttachmentChoiceMachine[] = machines
    .filter((entry) => !attachedMachines.has(entry.id))
    .map(({ retiredAt, technology, ...entry }) => ({
      ...entry,
      technology: technology ?? undefined,
      retired: retiredAt !== null,
    }));
  const machineGroups = groupMachines(offeredMachines).map((group) => ({
    ...group,
    machines: [...group.machines.filter((entry) => !entry.retired), ...group.machines.filter((entry) => entry.retired)],
  }));
  return {
    title: row.title,
    removed: false,
    machineGroups,
    machineModelGroups: groupMachineModels(
      models
        .filter((entry) => !attachedModels.has(entry.id))
        .map(({ technology, ...entry }) => ({ ...entry, technology: technology ?? undefined })),
    ),
  };
}
