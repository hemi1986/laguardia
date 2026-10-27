/** Public interface of the Maintenance module (BC-Maintenance: maintenance plan and records) – ADR 0002. */
export { changeMaintenancePlanCommand } from "./change-maintenance-plan-command";
export type {
  ChangeMaintenancePlanError,
  ChangeMaintenancePlanInput,
  MaintenancePlanChange,
  MaintenanceTaskDetails,
  NewMaintenanceTask,
} from "./change-maintenance-plan";
export { changeMachinesOfMaintenanceTaskCommand } from "./change-machines-of-maintenance-task-command";
export type {
  ChangeMachinesOfMaintenanceTaskError,
  ChangeMachinesOfMaintenanceTaskInput,
} from "./change-machines-of-maintenance-task";
export { changeMaintenanceTasksOfMachineCommand } from "./change-tasks-of-machine-command";
export type {
  ChangeMaintenanceTasksOfMachineError,
  ChangeMaintenanceTasksOfMachineInput,
} from "./change-tasks-of-machine";
export {
  maintenancePlan,
  maintenancePlanVersion,
  maintenanceTaskAppliesTo,
  maintenanceTaskName,
  type ListedMaintenanceTask,
} from "./maintenance-plans";
export { dueMaintenance, overdueMaintenanceCounts, type DueMachine, type DueMaintenanceTask } from "./due-maintenance";
export { machineMaintenance, type MachineMaintenance } from "./machine-maintenance";
export { recordMaintenanceCommand } from "./record-maintenance-command";
export {
  maintenanceOutcomes,
  type MaintenanceOutcome,
  type MaintenanceRecord,
  type RecordMaintenanceError,
  type RecordMaintenanceInput,
} from "./record-maintenance";
export {
  maintenanceForRecording,
  maintenanceRecordById,
  maintenanceRecords,
  type MaintenanceForRecording,
  type NamedMaintenanceRecord,
} from "./maintenance-records";
export { maintenancePlanChangedBy, maintenanceRecordedIn } from "./in-command";
export { maintenanceForSeveral, type MachineToChoose, type MaintenanceForSeveral } from "./maintenance-for-several";
export { machineChoiceForMaintenanceTask, type ChoosableMachine } from "./machine-choice";
