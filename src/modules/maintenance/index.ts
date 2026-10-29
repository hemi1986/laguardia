/** Public interface of the Maintenance module (BC-Maintenance: maintenance plan and records) – ADR 0002. */
export { changeMaintenancePlanCommand } from "./change-maintenance-plan-command";
export type {
  ChangeMaintenancePlanError,
  ChangeMaintenancePlanInput,
  MaintenancePlanChange,
  MaintenanceTaskDetails,
  NewMaintenanceTask,
} from "./change-maintenance-plan";
export {
  changeMachinesOfMaintenanceTaskCommand,
  changeMaintenanceTasksOfMachineCommand,
} from "./change-machines-of-maintenance-task-command";
export type {
  ChangeMachinesOfMaintenanceTaskError,
  ChangeMachinesOfMaintenanceTaskInput,
  ChangeMaintenanceTasksOfMachineError,
  ChangeMaintenanceTasksOfMachineInput,
} from "./change-machines-of-maintenance-task";
export { maintenanceTaskAppliesTo } from "./machines-of-maintenance-task";
export {
  maintenancePlan,
  maintenancePlanVersion,
  maintenanceTaskName,
  removedMaintenanceTaskNames,
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
export {
  maintenanceForSeveral,
  type FurtherMachineToChoose,
  type MachineToChoose,
  type MaintenanceForSeveral,
} from "./maintenance-for-several";
export { machineChoiceForMaintenanceTask, type ChoosableMachine } from "./machine-choice";
export {
  maintenanceTaskChoiceForMachine,
  maintenanceTaskChoiceForNewMachine,
  type ChoiceForNewMachine,
  type ChoosableTask,
  type ModelOfNewMachine,
  type TaskGroup,
} from "./maintenance-task-choice";
export {
  registerMachineWithMaintenanceTasksCommand,
  type ChosenMaintenanceTasks,
} from "./registration-applies-chosen-maintenance-tasks";
