import { machineForMaintenance } from "@/modules/collection";
import { aggregateCommand, type Database } from "@/platform/command";
import {
  changeMaintenancePlan,
  maintenancePlanActors,
  type ChangeMaintenancePlanInput,
  type ChosenMachines,
} from "./change-maintenance-plan";
import { MAINTENANCE_PLAN_ID } from "./maintenance-plan";
import { maintenancePlans } from "./maintenance-plans";
import { maintenanceEvents } from "./events";

/**
 * The chosen machines of an added maintenance task as Collection knows them (context map), read in the command's
 * transaction. Each read takes the machine's retirement lock shared (ADR 0010), so a retirement in flight decides
 * first – in the order of the machine IDs, so two steps cannot wait for each other. Nothing else is read: changing or
 * removing a task chooses no machine.
 */
export async function chosenMachines(tx: Database, input: ChangeMaintenancePlanInput): Promise<ChosenMachines> {
  const found = new Map<string, { retired: boolean }>();
  if (input.change !== "add") return found;
  for (const machineId of [...new Set(input.task.machineIds)].sort()) {
    const machine = await machineForMaintenance(tx, machineId);
    if (machine) found.set(machineId, { retired: machine.retired });
  }
  return found;
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
