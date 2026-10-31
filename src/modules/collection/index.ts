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
export { fileToOpen, machineFile, type FileOfMachine, type MachineFile } from "./files";
export { removeFileCommand } from "./remove-file-command";
export { mayRemoveFiles, removeFileRefusal } from "./remove-file";
export type { RemoveFileError, RemoveFileInput } from "./remove-file";
export { changeMachineStatusCommand } from "./change-machine-status-command";
export { machineStatusesToChangeTo } from "./change-machine-status";
export type { ChangeMachineStatusError, ChangeMachineStatusInput } from "./change-machine-status";
export { correctMachineDetailsCommand } from "./correct-machine-details-command";
export { correctDetailsRefusal } from "./correct-machine-details";
export { machineOfMuseumNumber } from "./museum-numbers";
export type { CorrectMachineDetailsError, CorrectMachineDetailsInput } from "./correct-machine-details";
export { correctMachineModelCommand } from "./correct-machine-model-command";
export type { CorrectMachineModelError, CorrectMachineModelInput } from "./correct-machine-model";
export { createMachineModelCommand } from "./create-machine-model-command";
export { machineCategories, technologies, technologiesOf } from "./create-machine-model";
export type { CreateMachineModelInput, MachineCategory, MachineModel, Technology } from "./create-machine-model";
export { groupMachines, type MachineGroup } from "./machine-groups";
export { machineModelForTeam, machineModelsToChooseFrom, type MachineModelForTeam } from "./machine-models";
export { changeMuseumDetailsCommand } from "./change-museum-details-command";
export type { ChangeMuseumDetailsError, ChangeMuseumDetailsInput } from "./change-museum-details";
export { museumName, museumSettings, type MuseumSettings } from "./museum-settings";
export { welcomePage, type MachineOnDisplay, type MachinesOnDisplayGroup, type WelcomePage } from "./welcome-page";
export { moveMachineCommand } from "./move-machine-command";
export type { MoveMachineError, MoveMachineInput } from "./move-machine";
export { registerMachineCommand } from "./register-machine-command";
/**
 * CMD-RetireMachine without the policies of the modules that react to it – retire a machine with Repair's
 * `retireMachineCommand`, which adds them (ADR 0010). Only Repair builds on this one.
 */
export { retireMachineCommand as retireMachineCommandWithoutPolicies } from "./retire-machine-command";
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
  statusHistoryOfMachine,
  latestStatusChanges,
  machineForTeamForm,
  machineForReporting,
  holdAgainstRetirement,
  machineIdOf,
  machineLabels,
  type MachineLabel,
  machineForMaintenance,
  machinesForMaintenance,
  type MachineForMaintenance,
  type MachineForTeamForm,
  visitorMachine,
  machineStatusCounts,
  retiredMachineCount,
  statusChangesSince,
  type RecentStatusChange,
  type MachineOverviewEntry,
  type MachineRecord,
  type VisitorMachine,
  type MachineOverviewQuery,
} from "./machines";
export {
  collectionChangesIn,
  fileAttachedIn,
  fileRemovedIn,
  machineModelChangeIn,
  machineRegisteredIn,
} from "./in-command";
