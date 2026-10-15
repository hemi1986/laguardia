/** Public interface of the Maintenance module (BC-Maintenance: maintenance plan and records) – ADR 0002. */
export { changeMaintenancePlanCommand } from "./change-maintenance-plan-command";
export type {
  ChangeMaintenancePlanError,
  ChangeMaintenancePlanInput,
  NewMaintenanceTask,
} from "./change-maintenance-plan";
export {
  maintenancePlan,
  maintenancePlanVersion,
  maintenanceTaskAppliesTo,
  type ListedMaintenanceTask,
} from "./maintenance-plans";
export { dueMaintenance, type DueMachine, type DueMaintenanceTask } from "./due-maintenance";
export { recordMaintenanceCommand } from "./record-maintenance-command";
export {
  maintenanceOutcomes,
  recordRefusal,
  type MaintenanceOutcome,
  type MaintenanceRecord,
  type RecordMaintenanceError,
  type RecordMaintenanceInput,
} from "./record-maintenance";
export { maintenanceRecords } from "./maintenance-records";
