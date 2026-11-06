import type { ChoiceGroup } from "@/components/ui/grouped-choice";
import type { AttachmentChoiceGroups } from "@/modules/collection";
import { teamMessages } from "@/platform/messages";
import {
  categoryAndTechnologyLabel,
  machineChoiceGroups,
  machineEntryLabel,
} from "@/app/(team)/team/category-and-technology";
import { targetValue } from "./file-attachments";

/**
 * Collection's choice of things a file can be attached to (RM-AttachmentChoice, G27) as the two parts of the form show
 * it – „Geräte“ and „Modelle“, each grouped by machine category and technology. A retired machine reads
 * „LG-041 · Ausgemustert“, an active one „LG-042 · Medieval Madness“; a machine model reads its title. The one place the
 * form „Anhängen“ (ST-115) and the form „Datei hinzufügen“ (ST-119) map it.
 */
export function attachmentChoiceGroups(choice: AttachmentChoiceGroups): {
  machineGroups: ChoiceGroup[];
  machineModelGroups: ChoiceGroup[];
} {
  return {
    machineGroups: machineChoiceGroups(choice.machineGroups, (machine) => ({
      value: targetValue({ machineId: machine.id }),
      label: machine.retired
        ? teamMessages.fileDetails.retiredMachine(machine.museumNumber)
        : machineEntryLabel(machine),
    })),
    machineModelGroups: choice.machineModelGroups.map((group) => ({
      key: `machineModel:${group.machineCategory}/${group.technology ?? ""}`,
      label: categoryAndTechnologyLabel(group.machineCategory, group.technology),
      entries: group.machineModels.map((model) => ({
        value: targetValue({ machineModelId: model.id }),
        label: model.title,
      })),
    })),
  };
}
