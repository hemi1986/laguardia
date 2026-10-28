import { aggregateCommand, type Command, type Database } from "@/platform/command";
import {
  changeMachinesActors,
  changeMachinesOfMaintenanceTask,
  touched,
  type ChangeInput,
  type ChangeMachinesOfMaintenanceTaskError,
  type ChangeMachinesOfMaintenanceTaskInput,
  type ChangeMaintenanceTasksOfMachineError,
  type ChangeMaintenanceTasksOfMachineInput,
} from "./change-machines-of-maintenance-task";
import { readChosenMachines, type ChosenMachines } from "./chosen-machines";
import { maintenanceEvents } from "./events";
import { MAINTENANCE_PLAN_ID } from "./maintenance-plan";
import { maintenancePlans } from "./maintenance-plans";

/**
 * The facts the decision needs, read in the command's transaction: the machines the change touches as Collection knows
 * them – from a task those newly ticked and unticked, from the machine record the one machine.
 */
async function machinesOfChange(tx: Database, input: ChangeInput): Promise<ChosenMachines> {
  if ("machineId" in input) return readChosenMachines(tx, [input.machineId]);
  const { newlyTicked, unticked } = touched(input);
  return readChosenMachines(tx, [...newlyTicked, ...unticked]);
}

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
