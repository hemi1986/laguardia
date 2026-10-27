import type { ChoiceGroup } from "@/components/ui/grouped-choice";
import { machineChoiceForMaintenanceTask, maintenancePlan, maintenanceTaskName } from "@/modules/maintenance";
import { isId, type Database } from "@/platform/command";
import { choiceGroups } from "../../choice-groups";

/**
 * What the form page „Geräte ändern“ needs (ST-095): the maintenance task, the machines in groups and the ones the task
 * applies to now (`chosen`, also what the form posts as seen). A task that is not in the plan (any more) has a name only
 * when it was removed; an address that is no task has none.
 */
export type ChangeMachinesData = {
  task: { id: string; name: string; removed: boolean; machineCount: number } | undefined;
  groups: ChoiceGroup[];
  chosen: string[];
};

export async function loadChangeMachines(db: Database, maintenanceTaskId: string): Promise<ChangeMachinesData> {
  if (!isId(maintenanceTaskId)) return { task: undefined, groups: [], chosen: [] };
  const [plan, machines] = await Promise.all([
    maintenancePlan(db),
    machineChoiceForMaintenanceTask(db, maintenanceTaskId),
  ]);
  const listed = plan.maintenanceTasks.find((each) => each.id === maintenanceTaskId);
  // A removed task keeps its name: an action re-renders this page, and a rejection because it was removed meanwhile
  // must keep the form and what was ticked (ST-019 review).
  const name = listed?.name ?? (await maintenanceTaskName(db, maintenanceTaskId));
  return {
    task:
      name === undefined
        ? undefined
        : { id: maintenanceTaskId, name, removed: !listed, machineCount: listed?.machineCount ?? 0 },
    groups: choiceGroups(machines),
    chosen: machines.flatMap((group) =>
      group.machines.filter((machine) => machine.chosen).map((machine) => machine.machineId),
    ),
  };
}
