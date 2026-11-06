import { eventCatalogue } from "@/platform/command";
import type { FileAdded, FileAttached } from "./add-file";
import type { FileDetailsChanged } from "./change-file-details";
import type { FileDetached } from "./detach-file";
import type { FileRemoved } from "./remove-file";
import type { MachineStatusChanged } from "./change-machine-status";
import type { MachineDetailsCorrected } from "./correct-machine-details";
import type { MachineModelCorrected } from "./correct-machine-model";
import type { MachineModelCreated } from "./create-machine-model";
import type { MachineMoved } from "./move-machine";
import type { MachineRegistered } from "./register-machine";
import type { MachineRetired } from "./retire-machine";
import type { MuseumDetailsChanged } from "./change-museum-details";
import type { LogoRemoved, LogoReplaced } from "./replace-logo";
import type { LegalTextsChanged } from "./change-legal-texts";

/**
 * Collection's event catalogue (ST-079, architecture review 2026-10-17): per event its aggregate and what reaches the
 * journal – references and facts from fixed lists only. Locations, serial numbers and status reasons are typed text
 * and stay in the aggregates (ST-003). A new Collection event is added here; its command passes `collectionEvents.journal`.
 */
export const collectionEvents = eventCatalogue({
  "EVT-MachineModelCreated": {
    aggregate: "AGG-MachineModel",
    // A machine model belongs to no machine; its machines refer to it (ST-007).
    project: (event: MachineModelCreated) => ({
      aggregateId: event.machineModelId,
      machineId: null,
      data: { machineCategory: event.machineCategory, technology: event.technology ?? null },
    }),
  },
  "EVT-MachineModelCorrected": {
    aggregate: "AGG-MachineModel",
    // Title and manufacturer are typed text and stay in the aggregate; the year is a number, a fact (ST-036).
    project: (event: MachineModelCorrected) => ({
      aggregateId: event.machineModelId,
      machineId: null,
      data: { year: event.year ?? null, machineCategory: event.machineCategory, technology: event.technology ?? null },
    }),
  },
  "EVT-MachineRegistered": {
    aggregate: "AGG-Machine",
    project: (event: MachineRegistered) => ({
      aggregateId: event.machineId,
      machineId: event.machineId,
      data: {
        museumNumber: event.museumNumber,
        machineModelId: event.machineModelId,
        machineStatus: event.machineStatus,
      },
    }),
  },
  "EVT-MachineStatusChanged": {
    aggregate: "AGG-Machine",
    project: (event: MachineStatusChanged) => ({
      aggregateId: event.machineId,
      machineId: event.machineId,
      data: { previousStatus: event.previousStatus, newStatus: event.newStatus },
    }),
  },
  "EVT-MachineMoved": {
    aggregate: "AGG-Machine",
    // The new location is typed text and stays in the aggregate; the journal names the machine and who moved it.
    project: (event: MachineMoved) => ({ aggregateId: event.machineId, machineId: event.machineId, data: {} }),
  },
  "EVT-MachineDetailsCorrected": {
    aggregate: "AGG-Machine",
    // The museum numbers are references the stickers print – the confirmation names both (ST-035); the serial
    // number is typed text and stays in the aggregate.
    project: (event: MachineDetailsCorrected) => ({
      aggregateId: event.machineId,
      machineId: event.machineId,
      data: { museumNumber: event.museumNumber, previousMuseumNumber: event.previousMuseumNumber },
    }),
  },
  "EVT-MachineRetired": {
    aggregate: "AGG-Machine",
    // The reason is typed text and stays in the aggregate; the journal names the machine and who retired it.
    project: (event: MachineRetired) => ({ aggregateId: event.machineId, machineId: event.machineId, data: {} }),
  },
  "EVT-FileAdded": {
    aggregate: "AGG-File",
    // The title and the original file name are typed text and stay in the aggregate (ST-003); the file category is a
    // fact from a fixed list. A file belongs to no machine – what it is attached to is EVT-FileAttached (ST-113).
    project: (event: FileAdded) => ({
      aggregateId: event.fileId,
      machineId: null,
      data: { fileCategory: event.fileCategory },
    }),
  },
  "EVT-FileAttached": {
    aggregate: "AGG-File",
    // One event per machine or machine model (ST-113). Journal entries from before carry the file category too and
    // stand for adding the file as well. A machine model belongs to no one machine.
    project: (event: FileAttached) => ({
      aggregateId: event.fileId,
      machineId: event.machineId ?? null,
      data: { machineModelId: event.machineModelId ?? null },
    }),
  },
  "EVT-FileDetached": {
    aggregate: "AGG-File",
    // The file no longer shows there (ST-115); a machine model belongs to no one machine. Who detached it is the
    // journal's actor.
    project: (event: FileDetached) => ({
      aggregateId: event.fileId,
      machineId: "machineId" in event ? event.machineId : null,
      data: { machineModelId: "machineModelId" in event ? event.machineModelId : null },
    }),
  },
  "EVT-FileDetailsChanged": {
    aggregate: "AGG-File",
    // Which details changed and the file category, a fact from a fixed list; the typed title stays in the aggregate, like
    // the museum name (ST-116, events.yaml). Who changed it is the journal's actor.
    project: (event: FileDetailsChanged) => ({
      aggregateId: event.fileId,
      machineId: null,
      data: { changedDetails: event.changedDetails, fileCategory: event.fileCategory },
    }),
  },
  "EVT-FileRemoved": {
    aggregate: "AGG-File",
    // Which file and who removed it (the journal's actor); its title stays in the kept record (ST-038). Since ST-115 a
    // file may be attached to several things, so the removal names no machine (events.yaml: File, Removed by).
    project: (event: FileRemoved) => ({
      aggregateId: event.fileId,
      machineId: null,
      data: {},
    }),
  },
  "EVT-MuseumDetailsChanged": {
    aggregate: "AGG-MuseumSettings",
    // The museum name is typed text and stays in the museum settings; the journal names which details changed and the
    // listing, a yes or no (ST-100).
    project: (event: MuseumDetailsChanged) => ({
      aggregateId: event.museumDetailsId,
      machineId: null,
      data: { changedDetails: event.changedDetails, machinesListed: event.machinesListed },
    }),
  },
  "EVT-LogoReplaced": {
    aggregate: "AGG-MuseumSettings",
    // The content references and the media type (ST-102) – who replaced it is the journal's actor.
    project: (event: LogoReplaced) => ({
      aggregateId: event.museumLogoId,
      machineId: null,
      data: { logo: event.logo, contentType: event.contentType, previousLogo: event.previousLogo ?? null },
    }),
  },
  "EVT-LogoRemoved": {
    aggregate: "AGG-MuseumSettings",
    // The removed logo's content reference (ST-102) – who removed it is the journal's actor.
    project: (event: LogoRemoved) => ({
      aggregateId: event.museumLogoId,
      machineId: null,
      data: { removedLogo: event.removedLogo },
    }),
  },
  "EVT-LegalTextsChanged": {
    aggregate: "AGG-MuseumSettings",
    // The legal texts are typed text and stay in the museum settings; the journal names which texts changed – who changed
    // them is the journal's actor (ST-103).
    project: (event: LegalTextsChanged) => ({
      aggregateId: event.legalTextsId,
      machineId: null,
      data: { changedTexts: event.changedTexts },
    }),
  },
});
