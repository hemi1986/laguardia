import { aggregateCommand, type Database } from "@/platform/command";
import {
  changeMachinesActors,
  changeMachinesOfMaintenanceTask,
  machinesTouched,
  type ChangeMachinesOfMaintenanceTaskInput,
} from "./change-machines-of-maintenance-task";
import { readChosenMachines, type ChosenMachines } from "./chosen-machines";
import { maintenanceEvents } from "./events";
import { MAINTENANCE_PLAN_ID } from "./maintenance-plan";
import { maintenancePlans } from "./maintenance-plans";

/** The machines the change touches as Collection knows them: those to add must exist and stay, those to remove must not be retired. */
export async function machinesToAdd(
  tx: Database,
  input: ChangeMachinesOfMaintenanceTaskInput,
): Promise<ChosenMachines> {
  return readChosenMachines(tx, machinesTouched(input));
}

/**
 * CMD-ChangeMachinesOfMaintenanceTask through the command layer (ST-095): the difference between the machines seen and
 * the machines ticked is applied to the plan as it is stored now. It names no version – the plan is loaded with a lock,
 * so two changes sent at the same time both stand, and one that is already made is nothing to do, not a conflict. Emits
 * EVT-MachinesOfMaintenanceTaskChanged with the machines added and removed, or nothing when nothing changed.
 */
export const changeMachinesOfMaintenanceTaskCommand = aggregateCommand({
  id: "CMD-ChangeMachinesOfMaintenanceTask",
  allowedActors: changeMachinesActors,
  store: maintenancePlans,
  target: () => ({ id: MAINTENANCE_PLAN_ID }),
  versionless: true,
  mayChangeNothing: true,
  facts: (tx, input) => machinesToAdd(tx, input),
  decide: changeMachinesOfMaintenanceTask,
  journal: maintenanceEvents.journal,
  result: () => ({}),
});
