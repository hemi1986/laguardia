import { groupMachines, machinesForMaintenance, type MachineGroup } from "@/modules/collection";
import type { Database } from "@/platform/command";
import { activeMaintenanceTasks } from "./maintenance-plans";
import { maintenanceTaskAppliesTo } from "./machines-of-maintenance-task";

/** A machine a technician can choose for a maintenance task – what they recognise it by, and whether it is away. */
export type ChoosableMachine = {
  machineId: string;
  museumNumber: string;
  machineModelTitle: string;
  /** Not on display: it can be chosen, but the task becomes due only on its return (HS-20, G27). */
  notOnDisplay: boolean;
  /** The task applies to it – always false while choosing for a task that is not there yet (ST-095). */
  chosen: boolean;
};

/**
 * RM-MachineChoiceForMaintenanceTask (ST-094): the machines a technician can choose for a maintenance task – every
 * machine that is not retired, in groups by machine category and technology as CONTEXT.md orders them, by museum
 * number inside a group; a group without a machine is not there. With a maintenance task (ST-095, changing its machines)
 * each machine says whether the task applies to it. On Collection's machines as it publishes them for maintenance
 * (context map, read here in one call).
 */
export async function machineChoiceForMaintenanceTask(
  db: Database,
  maintenanceTaskId?: string,
): Promise<MachineGroup<ChoosableMachine>[]> {
  const [machines, tasks] = await Promise.all([
    machinesForMaintenance(db),
    maintenanceTaskId ? activeMaintenanceTasks(db) : [],
  ]);
  const task = tasks.find((each) => each.id === maintenanceTaskId);
  return groupMachines(
    machines.map((machine) => ({
      machineId: machine.id,
      museumNumber: machine.museumNumber,
      machineModelTitle: machine.machineModelTitle,
      machineCategory: machine.machineCategory,
      technology: machine.technology,
      notOnDisplay: machine.machineStatus === "not-on-display",
      chosen: !!task && maintenanceTaskAppliesTo(task, machine.id),
    })),
  ).map((group) => ({
    ...group,
    machines: group.machines.map(({ machineCategory: _category, technology: _technology, ...machine }) => machine),
  }));
}
