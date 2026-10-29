import type { ChoiceGroup } from "@/components/ui/grouped-choice";
import { machineForTeamForm } from "@/modules/collection";
import { maintenanceTaskChoiceForMachine } from "@/modules/maintenance";
import type { Database } from "@/platform/command";
import { taskChoiceGroups } from "../../task-choice";

/**
 * What the form page „Wartungsaufgaben ändern“ needs (ST-096): the machine, the tasks in groups by interval and the ones
 * that apply to it now (`chosen`, also what the form posts as seen). A museum number that is no machine has none.
 */
export type ChangeTasksData = {
  machine: { id: string; museumNumber: string; retired: boolean } | undefined;
  groups: ChoiceGroup[];
  chosen: string[];
};

export async function loadChangeTasks(db: Database, museumNumber: string): Promise<ChangeTasksData> {
  const machine = await machineForTeamForm(db, museumNumber);
  if (!machine) return { machine: undefined, groups: [], chosen: [] };
  const groups = await maintenanceTaskChoiceForMachine(db, machine.id);
  return {
    machine: { id: machine.id, museumNumber: machine.museumNumber, retired: machine.retired },
    groups: taskChoiceGroups(groups),
    chosen: groups.flatMap((group) => group.tasks.filter((task) => task.chosen).map((task) => task.maintenanceTaskId)),
  };
}
