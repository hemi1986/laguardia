import { groupMachines, machinesForMaintenance, type MachineGroup } from "@/modules/collection";
import type { Database } from "@/platform/command";

/** A machine a technician can choose for a maintenance task – what they recognise it by, and whether it is away. */
export type ChoosableMachine = {
  machineId: string;
  museumNumber: string;
  machineModelTitle: string;
  /** Not on display: it can be chosen, but the task becomes due only on its return (HS-20, G27). */
  notOnDisplay: boolean;
};

/**
 * RM-MachineChoiceForMaintenanceTask (ST-094): the machines a technician can choose for a maintenance task – every
 * machine that is not retired, in groups by machine category and technology as CONTEXT.md orders them, by museum
 * number inside a group; a group without a machine is not there. On Collection's machines as it publishes them for
 * maintenance (context map, read here in one call).
 */
export async function machineChoiceForMaintenanceTask(db: Database): Promise<MachineGroup<ChoosableMachine>[]> {
  const machines = await machinesForMaintenance(db);
  return groupMachines(
    machines.map((machine) => ({
      machineId: machine.id,
      museumNumber: machine.museumNumber,
      machineModelTitle: machine.machineModelTitle,
      machineCategory: machine.machineCategory,
      technology: machine.technology,
      notOnDisplay: machine.machineStatus === "not-on-display",
    })),
  ).map((group) => ({
    ...group,
    machines: group.machines.map(({ machineCategory: _category, technology: _technology, ...machine }) => machine),
  }));
}
