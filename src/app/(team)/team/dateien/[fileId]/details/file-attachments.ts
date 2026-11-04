import type { AttachedTo, FileAttachedTo } from "@/modules/collection";
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

/**
 * The target as a form field and as the address's `detached` value (ST-115): `machine:<id>` or `machineModel:<id>` – one
 * shape for the one-tap form, the landing and the page that names what was detached.
 */
export function attachmentTargetValue(target: FileAttachedTo | AttachedTo): string {
  if ("kind" in target) {
    return target.kind === "machine" ? `machine:${target.machineId}` : `machineModel:${target.machineModelId}`;
  }
  return "machineId" in target ? `machine:${target.machineId}` : `machineModel:${target.machineModelId}`;
}

/** The target a one-tap form posted – none for a missing or malformed value (a forged form). */
export function attachmentTargetOf(value: string | undefined): AttachedTo | undefined {
  if (!value) return undefined;
  const separator = value.indexOf(":");
  if (separator < 0) return undefined;
  const kind = value.slice(0, separator);
  const id = value.slice(separator + 1);
  if (!id) return undefined;
  if (kind === "machine") return { machineId: id };
  if (kind === "machineModel") return { machineModelId: id };
  return undefined;
}
