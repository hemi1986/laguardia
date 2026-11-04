import type { FileAttachedTo } from "@/modules/collection";
import { teamMessages } from "@/platform/messages";

const { fileDetails } = teamMessages;

/**
 * What a file is attached to, in the one wording „Angehängt an“ uses (RM-FileDetails, ST-114) – the details page and the
 * removal question (ST-121) share it, so a retired machine reads „LG-041 · Ausgemustert“ in both.
 */
export function attachedToText(target: FileAttachedTo): string {
  if (target.kind === "machine-model") return fileDetails.machineModel(target.title);
  return target.retired
    ? fileDetails.retiredMachine(target.museumNumber)
    : fileDetails.machine(target.museumNumber, target.machineModelTitle);
}
