import { aggregateCommand, type Database } from "@/platform/command";
import {
  changeMaintenancePlan,
  maintenancePlanActors,
  type ChangeMaintenancePlanInput,
} from "./change-maintenance-plan";
import { readChosenMachines, type ChosenMachines } from "./chosen-machines";
import { MAINTENANCE_PLAN_ID } from "./maintenance-plan";
import { maintenancePlans } from "./maintenance-plans";
import { maintenanceEvents } from "./events";

/**
 * The chosen machines of an added maintenance task as Collection knows them. Nothing is read for changing or removing a
 * task: that chooses no machine.
 */
export async function chosenMachines(tx: Database, input: ChangeMaintenancePlanInput): Promise<ChosenMachines> {
  return input.change === "add" ? readChosenMachines(tx, input.task.machineIds) : new Map();
}

/**
 * CMD-ChangeMaintenancePlan through the command layer: a change of the one AGG-MaintenancePlan at the version the
 * technician saw (HS-16), emits EVT-MaintenancePlanChanged – and, for a new task with machines, the machines chosen for
 * it in the same step, stored together or not at all (EVT-MachinesOfMaintenanceTaskChanged). The journal names the
 * maintenance task, the kind of change and the machines – never its name or instruction, which are typed text (journal
 * convention, 2026-09-27).
 */
export const changeMaintenancePlanCommand = aggregateCommand({
  id: "CMD-ChangeMaintenancePlan",
  allowedActors: maintenancePlanActors,
  store: maintenancePlans,
  target: (input) => ({ id: MAINTENANCE_PLAN_ID, version: input.version }),
  facts: (tx, input) => chosenMachines(tx, input),
  decide: changeMaintenancePlan,
  journal: maintenanceEvents.journal,
  result: (_plan, events) => ({ maintenanceTaskId: events[0].maintenanceTaskId }),
});
