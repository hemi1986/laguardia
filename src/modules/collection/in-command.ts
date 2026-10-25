import { entriesOf, type JournalEntry } from "@/platform/command";
import { collectionEvents } from "./events";
import type { MachineStatus } from "./register-machine";

/**
 * What one command did in Collection – asked of the events `lastCommandBy` returns, for a page's confirmation (G3,
 * architecture review 2026-10-18). The event types and their data stay this module's own.
 */
export function collectionChangesIn(command: readonly JournalEntry[], machineId: string) {
  const entries = entriesOf(collectionEvents, command);
  const statusChange = entries.find(
    (entry) => entry.type === "EVT-MachineStatusChanged" && entry.aggregate.id === machineId,
  );
  const correction = entries.find(
    (entry) => entry.type === "EVT-MachineDetailsCorrected" && entry.aggregate.id === machineId,
  );
  return {
    /** The machine's museum numbers before and after, when the command corrected its details (ST-035). */
    detailsCorrected:
      correction?.type === "EVT-MachineDetailsCorrected"
        ? {
            previousMuseumNumber: correction.data.previousMuseumNumber as string | undefined,
            museumNumber: correction.data.museumNumber as string | undefined,
          }
        : undefined,
    /** The machine's new status, when the command changed it. */
    statusChangedTo:
      statusChange?.type === "EVT-MachineStatusChanged"
        ? (statusChange.data.newStatus as MachineStatus | undefined)
        : undefined,
    moved: entries.some((entry) => entry.type === "EVT-MachineMoved" && entry.aggregate.id === machineId),
    retired: entries.some((entry) => entry.type === "EVT-MachineRetired" && entry.aggregate.id === machineId),
  };
}

/** Whether the command attached this file (ST-037). */
export function fileAttachedIn(command: readonly JournalEntry[], fileId: string): boolean {
  return entriesOf(collectionEvents, command).some(
    (entry) => entry.type === "EVT-FileAttached" && entry.aggregate.id === fileId,
  );
}

/** Whether the command registered this machine (ST-007). */
export function machineRegisteredIn(command: readonly JournalEntry[], machineId: string): boolean {
  return entriesOf(collectionEvents, command).some(
    (entry) => entry.type === "EVT-MachineRegistered" && entry.aggregate.id === machineId,
  );
}

/** Whether the command created (ST-006) or corrected (ST-036) this machine model. */
export function machineModelChangeIn(command: readonly JournalEntry[], machineModelId: string) {
  const entries = entriesOf(collectionEvents, command).filter((entry) => entry.aggregate.id === machineModelId);
  return {
    created: entries.some((entry) => entry.type === "EVT-MachineModelCreated"),
    corrected: entries.some((entry) => entry.type === "EVT-MachineModelCorrected"),
  };
}
