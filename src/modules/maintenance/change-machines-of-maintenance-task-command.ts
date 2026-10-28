import { aggregateCommand, type Command } from "@/platform/command";
import {
  changeMachinesActors,
  changeMachinesOfMaintenanceTask,
  machinesOfChange,
  type ChangeMachinesOfMaintenanceTaskError,
  type ChangeMachinesOfMaintenanceTaskInput,
  type ChangeMaintenanceTasksOfMachineError,
  type ChangeMaintenanceTasksOfMachineInput,
} from "./change-machines-of-maintenance-task";
import { maintenanceEvents } from "./events";
import { MAINTENANCE_PLAN_ID } from "./maintenance-plan";
import { maintenancePlans } from "./maintenance-plans";

/**
 * CMD-ChangeMachinesOfMaintenanceTask through the command layer – from a task (ST-095) or from the machine record
 * (ST-096): the difference between what was seen and what is ticked is applied to the plan as it is stored now. It names
 * no version – the plan is loaded with a lock, so two changes sent at the same time both stand, and one that is already
 * made is nothing to do, not a conflict. One EVT-MachinesOfMaintenanceTaskChanged per task that changed, or nothing.
 */
const changeMachinesOfMaintenanceTasksCommand = aggregateCommand({
  id: "CMD-ChangeMachinesOfMaintenanceTask",
  allowedActors: changeMachinesActors,
  store: maintenancePlans,
  target: () => ({ id: MAINTENANCE_PLAN_ID }),
  versionless: true,
  mayChangeNothing: true,
  facts: (tx, input) => machinesOfChange(tx, input),
  decide: changeMachinesOfMaintenanceTask,
  journal: maintenanceEvents.journal,
  result: () => ({}),
});

/** The command as the form of a task sends it (ST-095) – typed by what that form can give and get back. */
export const changeMachinesOfMaintenanceTaskCommand = changeMachinesOfMaintenanceTasksCommand as Command<
  ChangeMachinesOfMaintenanceTaskInput,
  Record<string, never>,
  ChangeMachinesOfMaintenanceTaskError
>;

/** The same command as the form on the machine record sends it (ST-096). */
export const changeMaintenanceTasksOfMachineCommand = changeMachinesOfMaintenanceTasksCommand as Command<
  ChangeMaintenanceTasksOfMachineInput,
  Record<string, never>,
  ChangeMaintenanceTasksOfMachineError
>;
