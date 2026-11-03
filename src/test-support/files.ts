import { randomUUID } from "node:crypto";
import {
  addFileCommand,
  machineModelOfMachineForAi,
  type AddFileInput,
  type FileCategory,
  type FileContent,
} from "@/modules/collection";
import type { Clock } from "@/platform/clock";
import { executeCommand, type Actor, type Database } from "@/platform/command";

/**
 * A file that exists, set up through CMD-AddFile (Q3) for tests whose subject is something else: added by the given team
 * member and attached to the machine ("machine"), to its machine model ("machine-model"), to both or to nothing. Its
 * content is only a name in the store's namespace unless the test gives its own (a test that reads the content puts it in
 * the store first). Returns the file's ID.
 */
export async function aFileAdded(
  db: Database,
  context: { actor: Actor; clock?: Clock; newId?: () => string },
  {
    machineId,
    to = "machine",
    title = "A file",
    fileCategory = "other",
    originalFileName,
    content = { name: `files/${randomUUID()}`, size: 4_200_000, contentType: "application/pdf" },
  }: {
    machineId: string;
    to?: "machine" | "machine-model" | "both" | "nothing";
    title?: string;
    fileCategory?: FileCategory;
    originalFileName?: string;
    content?: FileContent;
  },
): Promise<string> {
  const model = await machineModelOfMachineForAi(db, machineId);
  const input: AddFileInput = {
    title,
    fileCategory,
    originalFileName,
    machineIds: to === "machine" || to === "both" ? [machineId] : [],
    machineModelIds: (to === "machine-model" || to === "both") && model ? [model.id] : [],
    content,
  };
  const added = await executeCommand(addFileCommand, input, { newId: randomUUID, ...context, db });
  if (!added.ok) throw new Error(added.error);
  return added.result.fileId;
}
