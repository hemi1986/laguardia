import { aggregateCommand, isId, type Database } from "@/platform/command";
import { changeMachinesActors } from "./change-machines-of-maintenance-task";
import { changeMaintenanceTasksOfMachine, type ChangeMaintenanceTasksOfMachineInput } from "./change-tasks-of-machine";
import { readChosenMachines, type ChosenMachines } from "./chosen-machines";
import { maintenanceEvents } from "./events";
import { MAINTENANCE_PLAN_ID } from "./maintenance-plan";
import { maintenancePlans } from "./maintenance-plans";

/** The machine as Collection knows it – none for an ID that is no machine (a forged change), which the decision rejects. */
async function machineOfChange(tx: Database, input: ChangeMaintenanceTasksOfMachineInput): Promise<ChosenMachines> {
  return readChosenMachines(tx, isId(input.machineId) ? [input.machineId] : []);
}

/**
 * CMD-ChangeMachinesOfMaintenanceTask from the machine record (ST-096): the difference between the maintenance tasks seen
 * and ticked is applied to the plan as it is stored now – versionless like the change from a task (ST-095), so two
 * changes sent at the same time both stand and a change already made is nothing to do. One
 * EVT-MachinesOfMaintenanceTaskChanged per task that changed, or nothing when nothing changed.
 */
export const changeMaintenanceTasksOfMachineCommand = aggregateCommand({
  id: "CMD-ChangeMachinesOfMaintenanceTask",
  allowedActors: changeMachinesActors,
  store: maintenancePlans,
  target: () => ({ id: MAINTENANCE_PLAN_ID }),
  versionless: true,
  mayChangeNothing: true,
  facts: (tx, input) => machineOfChange(tx, input),
  decide: changeMaintenanceTasksOfMachine,
  journal: maintenanceEvents.journal,
  result: () => ({}),
});
