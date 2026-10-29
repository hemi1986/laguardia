import type { ChoiceGroup } from "@/components/ui/grouped-choice";
import type { ChoosableMachine } from "@/modules/maintenance";
import type { MachineCategory, MachineGroup, Technology } from "@/modules/collection";
import { teamMessages } from "@/platform/messages";

const { machineModels, maintenancePlan: texts } = teamMessages;

/** A kind of machine as G27 names its group: „Flipper · EM“ – by the machine category alone without a technology. */
export function machineKindLabel(machineCategory: MachineCategory, technology: Technology | undefined): string {
  return [machineModels.categories[machineCategory], technology && machineModels.technologies[technology]]
    .filter(Boolean)
    .join(" · ");
}

/**
 * The machines to choose from as the forms show them (RM-MachineChoiceForMaintenanceTask, G27): a group named by its
 * machine category and technology – by the category alone without one –, each machine „LG-042 · Medieval Madness“, and
 * „· Nicht ausgestellt“ after one that cannot become due while it is away. Shared by adding a maintenance task
 * (ST-094) and changing its machines (ST-095).
 */
export function choiceGroups(groups: MachineGroup<ChoosableMachine>[]): ChoiceGroup[] {
  return groups.map((group) => ({
    key: `${group.machineCategory}/${group.technology ?? ""}`,
    label: machineKindLabel(group.machineCategory, group.technology),
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
