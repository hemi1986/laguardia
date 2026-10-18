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
  LONGEST_BACK_DATING_DAYS,
  maintenanceOutcomes,
  recordRefusal,
  type MaintenanceOutcome,
  type MaintenanceRecord,
  type RecordMaintenanceError,
  type RecordMaintenanceInput,
} from "./record-maintenance";
export { maintenanceRecordById, maintenanceRecords } from "./maintenance-records";
export { maintenanceRecordedIn, maintenanceTaskAddedBy } from "./in-command";
