import { entriesOf, lastCommandBy, type Database, type JournalEntry, type TeamMemberId } from "@/platform/command";
import { collectionEvents } from "./events";
import { MUSEUM_LOGO_ID } from "./replace-logo";
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

/** Whether the command removed this file (ST-038). */
export function fileRemovedIn(command: readonly JournalEntry[], fileId: string): boolean {
  return entriesOf(collectionEvents, command).some(
    (entry) => entry.type === "EVT-FileRemoved" && entry.aggregate.id === fileId,
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

/**
 * What the team member's latest change of the logo was (ST-102), for the confirmation on the museum settings page (G3) –
 * only when the latest command on the logo is theirs. The logo's ID stays inside Collection, like the maintenance plan's.
 */
export async function logoChangedBy(db: Database, teamMemberId: TeamMemberId): Promise<"replaced" | "removed" | undefined> {
  const command = await lastCommandBy(db, { aggregateId: MUSEUM_LOGO_ID }, teamMemberId);
  const entries = command ? entriesOf(collectionEvents, command) : [];
  if (entries.some((entry) => entry.type === "EVT-LogoReplaced")) return "replaced";
  if (entries.some((entry) => entry.type === "EVT-LogoRemoved")) return "removed";
  return undefined;
}
