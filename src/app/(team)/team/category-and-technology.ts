import type { ChoiceGroup } from "@/components/ui/grouped-choice";
import type { MachineCategory, MachineGroup, Technology } from "@/modules/collection";
import { teamMessages } from "@/platform/messages";

const { machineModels } = teamMessages;

/**
 * A machine category and technology as G27 names their group: „Flipper · EM“ – by the machine category alone without a
 * technology. Shared by the choice of machines (ST-094, ST-095) and the proposals of the registration form (ST-097).
 */
export function categoryAndTechnologyLabel(
  machineCategory: MachineCategory,
  technology: Technology | undefined,
): string {
  return [machineModels.categories[machineCategory], technology && machineModels.technologies[technology]]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Collection's machine groups as a grouped choice shows them (G27): each named by its machine category and technology,
 * its entries as `entryOf` says – the machines of a maintenance task (ST-094, ST-095), the sticker selection and the
 * further machines of recording for several (ST-098).
 */
export function machineChoiceGroups<Machine>(
  groups: MachineGroup<Machine>[],
  entryOf: (machine: Machine) => ChoiceGroup["entries"][number],
): ChoiceGroup[] {
  return groups.map((group) => ({
    key: `${group.machineCategory}/${group.technology ?? ""}`,
    label: categoryAndTechnologyLabel(group.machineCategory, group.technology),
    entries: group.machines.map(entryOf),
  }));
}
