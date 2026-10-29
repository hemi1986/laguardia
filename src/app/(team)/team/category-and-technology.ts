import type { MachineCategory, Technology } from "@/modules/collection";
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
