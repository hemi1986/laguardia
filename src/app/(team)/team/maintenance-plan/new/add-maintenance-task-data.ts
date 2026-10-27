import { machineChoiceForMaintenanceTask, maintenancePlanVersion } from "@/modules/maintenance";
import type { Database } from "@/platform/command";
import type { ChoiceGroup } from "@/components/ui/grouped-choice";
import { choiceGroups } from "../choice-groups";

/** What the form page „Wartungsaufgabe hinzufügen“ needs: the version of the plan and the machines, in groups. */
export type AddMaintenanceTaskData = { version: number; groups: ChoiceGroup[] };

/** The version of the plan and the machines to choose from as the form shows them (see `choiceGroups`). */
export async function loadAddMaintenanceTask(db: Database): Promise<AddMaintenanceTaskData> {
  const [version, groups] = await Promise.all([maintenancePlanVersion(db), machineChoiceForMaintenanceTask(db)]);
  return { version, groups: choiceGroups(groups) };
}
