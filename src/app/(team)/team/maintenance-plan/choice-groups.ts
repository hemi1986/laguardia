import type { ChoiceGroup } from "@/components/ui/grouped-choice";
import type { ChoosableMachine } from "@/modules/maintenance";
import type { MachineGroup } from "@/modules/collection";
import { teamMessages } from "@/platform/messages";
import { categoryAndTechnologyLabel } from "../category-and-technology";

const { maintenancePlan: texts } = teamMessages;

/**
 * The machines to choose from as the forms show them (RM-MachineChoiceForMaintenanceTask, G27): a group named by its
 * machine category and technology – by the category alone without one –, each machine „LG-042 · Medieval Madness“, and
 * „· Nicht ausgestellt“ after one that cannot become due while it is away. Shared by adding a maintenance task
 * (ST-094) and changing its machines (ST-095).
 */
export function choiceGroups(groups: MachineGroup<ChoosableMachine>[]): ChoiceGroup[] {
  return groups.map((group) => ({
    key: `${group.machineCategory}/${group.technology ?? ""}`,
    label: categoryAndTechnologyLabel(group.machineCategory, group.technology),
    entries: group.machines.map((machine) => ({
      value: machine.machineId,
      label: [
        texts.machines.entry(machine.museumNumber, machine.machineModelTitle),
        machine.notOnDisplay && texts.machines.notOnDisplay,
      ]
        .filter(Boolean)
        .join(" · "),
    })),
  }));
}
