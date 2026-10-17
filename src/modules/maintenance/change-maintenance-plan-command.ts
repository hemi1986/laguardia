import { aggregateCommand } from "@/platform/command";
import { changeMaintenancePlan, maintenancePlanActors } from "./change-maintenance-plan";
import { MAINTENANCE_PLAN_ID } from "./maintenance-plan";
import { maintenancePlans } from "./maintenance-plans";
import { maintenanceEvents } from "./events";

/**
 * CMD-ChangeMaintenancePlan through the command layer: a change of the one AGG-MaintenancePlan at the version the
 * technician saw (HS-16), emits EVT-MaintenancePlanChanged. The journal names the maintenance task and the kind of
 * change – never its name or instruction, which are typed text (journal convention, 2026-09-27).
 */
export const changeMaintenancePlanCommand = aggregateCommand({
  id: "CMD-ChangeMaintenancePlan",
  allowedActors: maintenancePlanActors,
  store: maintenancePlans,
  target: (input) => ({ id: MAINTENANCE_PLAN_ID, version: input.version }),
  decide: changeMaintenancePlan,
  journal: maintenanceEvents.journal,
  result: (_plan, events) => ({ maintenanceTaskId: events[0].maintenanceTaskId }),
});
