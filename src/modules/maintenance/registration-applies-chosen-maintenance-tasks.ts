import { registerMachineCommand } from "@/modules/collection";
import { policy, run, withPolicyInput } from "@/platform/command";
import { changeMaintenanceTasksOfMachineCommand } from "./change-machines-of-maintenance-task-command";

/** What the technician chose on the registration form for the policy – never data of the registration (HS-22). */
export type ChosenMaintenanceTasks = { maintenanceTaskIds: readonly string[] };

/**
 * POL-RegistrationAppliesChosenMaintenanceTasks (ST-097, HS-22): in the registration's step, the maintenance tasks the
 * technician chose apply to the new machine and are due there at once – CMD-ChangeMachinesOfMaintenanceTask from the
 * new machine's side (one EVT-MachinesOfMaintenanceTaskChanged per task), **run as the registering technician**, so
 * *Changed by* is them (a `run`, not a `trigger` as the system). Its rules hold as on the machine record: a task removed
 * meanwhile, an unknown one or one chosen twice rejects it – and so the whole registration. Nothing chosen runs nothing.
 */
const registrationAppliesChosenMaintenanceTasks = ({ maintenanceTaskIds }: ChosenMaintenanceTasks) =>
  policy({
    id: "POL-RegistrationAppliesChosenMaintenanceTasks",
    calls: async (_tx, { events }) => {
      const registered = events.find((event) => event.type === "EVT-MachineRegistered");
      if (!registered || maintenanceTaskIds.length === 0) return [];
      return [
        run(changeMaintenanceTasksOfMachineCommand, {
          machineId: registered.aggregate.id,
          seen: [],
          ticked: maintenanceTaskIds,
        }),
      ];
    },
  });

/**
 * CMD-RegisterMachine as the registration page runs it (ST-097, ADR 0010 option 3): Collection's command with
 * Maintenance's policy bound to the tasks chosen on the form – `{ command: <the registration>, policies: {
 * maintenanceTaskIds } }`. The machine and its maintenance tasks are stored together or not at all; Collection knows
 * nothing of maintenance tasks.
 */
export const registerMachineWithMaintenanceTasksCommand = withPolicyInput(
  registerMachineCommand,
  (chosen: ChosenMaintenanceTasks) => [registrationAppliesChosenMaintenanceTasks(chosen)],
);
