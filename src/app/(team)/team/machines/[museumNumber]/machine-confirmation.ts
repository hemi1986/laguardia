import { collectionChangesIn, fileAttachedIn, machineFile, fileRemovedIn } from "@/modules/collection";
import { maintenanceRecordById, maintenanceRecordedIn } from "@/modules/maintenance";
import { problemReportedIn } from "@/modules/repair";
import type { Clock } from "@/platform/clock";
import { isId, lastCommandBy, type Database, type TeamMemberId } from "@/platform/command";
import { loadTriageConfirmation, oneOf, type AddressQuery, type TriageConfirmation } from "../../triage-confirmation";
import type { MachineRecordData } from "./machine-record-data";

/**
 * What the machine record confirms (G3): the status change (ST-012), the move (ST-034), the correction of its details
 * – under a new museum number or not (ST-035), the problem report (ST-015),
 * the file attached (ST-037) or removed (ST-038), the maintenance recorded from it (ST-047), the retirement (ST-039) or the triage outcome of reporting and triaging in one step (ST-023, ST-052).
 */
export type MachineRecordConfirmation =
  | { kind: "status-changed" }
  | { kind: "moved" }
  | { kind: "renumbered"; previousMuseumNumber: string }
  | { kind: "details-corrected" }
  | { kind: "retired" }
  | { kind: "problem-reported" }
  | { kind: "file-attached"; title: string }
  | { kind: "file-removed"; title: string }
  | { kind: "maintenance-recorded" }
  | { kind: "triaged"; triaged: TriageConfirmation };

/**
 * The confirmation the address asks for – only when the latest command on the machine (or the file) was that action
 * and the team member looking at the page ran it (architecture review 2026-10-18: never from the address alone).
 */
export async function loadMachineConfirmation(
  db: Database,
  clock: Clock,
  viewer: TeamMemberId,
  record: Pick<MachineRecordData, "id" | "files">,
  query: AddressQuery,
): Promise<MachineRecordConfirmation | undefined> {
  const triaged = await loadTriageConfirmation(db, clock, viewer, query, record.id);
  if (triaged) return { kind: "triaged", triaged };
  const fileId = oneOf(query.attached);
  if (fileId) {
    const file = record.files.find((shown) => shown.id === fileId);
    const command = file && (await lastCommandBy(db, { aggregateId: fileId }, viewer));
    return file && command && fileAttachedIn(command, fileId)
      ? { kind: "file-attached", title: file.title }
      : undefined;
  }
  const removedFileId = oneOf(query.fileRemoved);
  if (removedFileId !== undefined) {
    if (!isId(removedFileId)) return undefined;
    // The machine record lists the file no more – its title comes from the kept record, only for a file of this page.
    const file = await machineFile(db, { fileId: removedFileId, machineId: record.id });
    const command = file && (await lastCommandBy(db, { aggregateId: removedFileId }, viewer));
    return file && command && fileRemovedIn(command, removedFileId)
      ? { kind: "file-removed", title: file.title }
      : undefined;
  }
  const maintenanceRecordId = oneOf(query.maintenanceRecorded);
  if (maintenanceRecordId !== undefined) {
    if (!isId(maintenanceRecordId)) return undefined;
    const command = await lastCommandBy(db, { aggregateId: maintenanceRecordId }, viewer);
    if (!command || !maintenanceRecordedIn(command, maintenanceRecordId)) return undefined;
    const recorded = await maintenanceRecordById(db, maintenanceRecordId);
    return recorded?.machineId === record.id ? { kind: "maintenance-recorded" } : undefined;
  }
  const asked = (["statusChanged", "moved", "corrected", "retired", "problemReported"] as const).find(
    (name) => query[name] !== undefined,
  );
  if (!asked) return undefined;
  const command = await lastCommandBy(db, { machineId: record.id }, viewer);
  if (!command) return undefined;
  const changes = collectionChangesIn(command, record.id);
  if (asked === "statusChanged" && changes.statusChangedTo) return { kind: "status-changed" };
  if (asked === "moved" && changes.moved) return { kind: "moved" };
  if (asked === "corrected" && changes.detailsCorrected) {
    const { previousMuseumNumber, museumNumber } = changes.detailsCorrected;
    return previousMuseumNumber && previousMuseumNumber !== museumNumber
      ? { kind: "renumbered", previousMuseumNumber }
      : { kind: "details-corrected" };
  }
  if (asked === "retired" && changes.retired) return { kind: "retired" };
  if (asked === "problemReported" && problemReportedIn(command, record.id)) return { kind: "problem-reported" };
  return undefined;
}
