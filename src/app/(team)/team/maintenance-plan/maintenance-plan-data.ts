import {
  maintenancePlan,
  maintenancePlanChangedBy,
  maintenanceTaskName,
  type ListedMaintenanceTask,
  type MaintenancePlanChange,
} from "@/modules/maintenance";
import { isId, type Database, type TeamMemberId } from "@/platform/command";

/**
 * A change of the maintenance plan the technician just made – named in the confirmation (G3) – or, after changing the
 * machines of a task, how many machines it applies to now (ST-095).
 */
export type MaintenancePlanConfirmation =
  { change: MaintenancePlanChange; name: string } | { change: "machines"; name: string; machineCount: number };

export type MaintenancePlanData = {
  plan: { version: number; maintenanceTasks: ListedMaintenanceTask[] };
  confirmation: MaintenancePlanConfirmation | undefined;
};

/** The address's parameter for each change – `?added=<id>`, `?changed=<id>`, `?removed=<id>`. */
const changes = ["added", "changed", "removed"] as const satisfies readonly MaintenancePlanChange[];

/**
 * The maintenance plan's data (ST-040, ST-041, ST-095). Back from a change, the address names the maintenance task and what
 * was done to it; the page confirms it only when the journal says it was the latest change of the plan and this
 * technician made it (G3) – never from the address alone.
 *
 * **The exception** is `?machinesChanged=<task>` after changing the machines of a task: a change that changes nothing
 * records no event, yet is confirmed (G33), so there is nothing to ask the journal. The confirmation states how many
 * machines the task applies to *now* and appears only for a task that is in the plan – it says what is true, whoever
 * opens the address.
 */
export async function loadMaintenancePlan(
  db: Database,
  teamMemberId: TeamMemberId,
  params: Record<string, string | string[] | undefined>,
): Promise<MaintenancePlanData> {
  const named = (change: MaintenancePlanChange) => {
    const value = params[change];
    return typeof value === "string" && isId(value) ? value : undefined;
  };
  const machinesChanged =
    typeof params.machinesChanged === "string" && isId(params.machinesChanged) ? params.machinesChanged : undefined;
  const change = changes.find((each) => named(each));
  const maintenanceTaskId = change && named(change);
  const [plan, confirmed] = await Promise.all([
    maintenancePlan(db),
    change && maintenanceTaskId
      ? maintenancePlanChangedBy(db, { maintenanceTaskId, change }, teamMemberId)
      : Promise.resolve(false),
  ]);
  const name = confirmed && maintenanceTaskId ? await maintenanceTaskName(db, maintenanceTaskId) : undefined;
  const task = plan.maintenanceTasks.find((each) => each.id === machinesChanged);
  return {
    plan,
    confirmation:
      change && name
        ? { change, name }
        : task
          ? { change: "machines", name: task.name, machineCount: task.machineCount }
          : undefined,
  };
}
