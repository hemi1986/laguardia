/** Public interface of the Collection module (BC-Collection: machines, machine models, files) – ADR 0002. */
export { attachFileCommand } from "./attach-file-command";
export { attachFileRefusal, attachTargets, fileCategories } from "./attach-file";
export type {
  AttachFileError,
  AttachFileInput,
  AttachFileInputError,
  AttachTarget,
  FileCategory,
  FileContent,
} from "./attach-file";
export { fileToOpen, type FileOfMachine } from "./files";
export { changeMachineStatusCommand } from "./change-machine-status-command";
export { machineStatusesToChangeTo } from "./change-machine-status";
export type { ChangeMachineStatusError, ChangeMachineStatusInput } from "./change-machine-status";
export { correctMachineModelCommand } from "./correct-machine-model-command";
export type { CorrectMachineModelError, CorrectMachineModelInput } from "./correct-machine-model";
export { createMachineModelCommand } from "./create-machine-model-command";
export { machineCategories, technologies, technologiesOf } from "./create-machine-model";
export type { CreateMachineModelInput, MachineCategory, MachineModel, Technology } from "./create-machine-model";
export { machineModelForTeam, machineModelsToChooseFrom, type MachineModelForTeam } from "./machine-models";
export { moveMachineCommand } from "./move-machine-command";
export type { MoveMachineError, MoveMachineInput } from "./move-machine";
export { registerMachineCommand } from "./register-machine-command";
export { retireMachineCommand } from "./retire-machine-command";
export { retireReasonRefusal, retireRefusal } from "./retire-machine";
export type { RetireMachineError, RetireMachineInput } from "./retire-machine";
export { machineStatuses } from "./register-machine";
export type {
  MachineStatus,
  RegisterMachineError,
  RegisterMachineInput,
  Retirement,
  StatusChange,
} from "./register-machine";
export {
  machineOverview,
  machineRecord,
  machineForTeamForm,
  machineForReporting,
  machineIdOf,
  machineLabels,
  machineForMaintenance,
  machinesForMaintenance,
  type MachineForMaintenance,
  type MachineForTeamForm,
  visitorMachine,
  machineStatusCounts,
  type MachineOverviewEntry,
  type MachineRecord,
  type VisitorMachine,
  type MachineOverviewQuery,
} from "./machines";
export { collectionChangesIn, fileAttachedIn, machineModelChangeIn, machineRegisteredIn } from "./in-command";
