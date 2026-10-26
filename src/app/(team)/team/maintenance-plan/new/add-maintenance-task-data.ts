import { machineChoiceForMaintenanceTask, maintenancePlanVersion } from "@/modules/maintenance";
import type { Database } from "@/platform/command";
import { teamMessages } from "@/platform/messages";
import type { ChoiceGroup } from "@/components/ui/grouped-choice";

const { machineModels, maintenancePlan: texts } = teamMessages;

/** What the form page „Wartungsaufgabe hinzufügen“ needs: the version of the plan and the machines, in groups. */
export type AddMaintenanceTaskData = { version: number; groups: ChoiceGroup[] };

/**
 * The machines to choose from as the form shows them (RM-MachineChoiceForMaintenanceTask, G27): a group named by its
 * machine category and technology – by the category alone without one –, each machine „LG-042 · Medieval Madness“, and
 * „· Nicht ausgestellt“ after one that cannot become due while it is away.
 */
export async function loadAddMaintenanceTask(db: Database): Promise<AddMaintenanceTaskData> {
  const [version, groups] = await Promise.all([maintenancePlanVersion(db), machineChoiceForMaintenanceTask(db)]);
  return {
    version,
    groups: groups.map((group) => ({
      key: `${group.machineCategory}/${group.technology ?? ""}`,
      label: [machineModels.categories[group.machineCategory], group.technology && machineModels.technologies[group.technology]]
        .filter(Boolean)
        .join(" · "),
      entries: group.machines.map((machine) => ({
        value: machine.machineId,
        label: [texts.machines.entry(machine.museumNumber, machine.machineModelTitle), machine.notOnDisplay && texts.machines.notOnDisplay]
          .filter(Boolean)
          .join(" · "),
      })),
    })),
  };
}
