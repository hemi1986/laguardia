import type { ChoiceGroup } from "@/components/ui/grouped-choice";
import { groupMachines } from "@/modules/collection";
import type { MachineToChoose, MaintenanceForSeveral } from "@/modules/maintenance";
import { teamMessages } from "@/platform/messages";
import { categoryAndTechnologyLabel } from "../../category-and-technology";

const { recordForSeveral: texts } = teamMessages;

/** The machines of „Für mehrere Geräte erfassen“ as its form shows them – the group „Fällig“ and the further groups. */
export type ChoiceOfSeveral = { due: ChoiceGroup | undefined; others: ChoiceGroup[] };

/**
 * The machines of „Für mehrere Geräte erfassen“ in groups that fold (ST-098, G27): the machines the task is due on in
 * the one group „Fällig“, in the due maintenance list's order; the further machines grouped by machine category and
 * technology, by museum number inside a group. Each „LG-042 · Medieval Madness · Halle 1“.
 */
export function choiceForSeveral({ due, others }: Pick<MaintenanceForSeveral, "due" | "others">): ChoiceOfSeveral {
  return {
    due: due.length > 0 ? { key: "due", label: texts.due, entries: due.map(entryOf) } : undefined,
    others: groupMachines(others).map((group) => ({
      key: `${group.machineCategory}/${group.technology ?? ""}`,
      label: categoryAndTechnologyLabel(group.machineCategory, group.technology),
      entries: group.machines.map(entryOf),
    })),
  };
}

function entryOf({ machineId, museumNumber, machineModelTitle, location }: MachineToChoose) {
  return { value: machineId, label: texts.entry(museumNumber, machineModelTitle, location) };
}
