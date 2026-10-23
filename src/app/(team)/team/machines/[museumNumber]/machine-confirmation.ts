import { collectionChangesIn, fileAttachedIn } from "@/modules/collection";
import { problemReportedIn } from "@/modules/repair";
import type { Clock } from "@/platform/clock";
import { lastCommandBy, type Database, type TeamMemberId } from "@/platform/command";
import { loadTriageConfirmation, oneOf, type AddressQuery, type TriageConfirmation } from "../../triage-confirmation";
import type { MachineRecordData } from "./machine-record-data";

/**
 * What the machine record confirms (G3): the status change (ST-012), the move (ST-034), the problem report (ST-015),
 * the file attached (ST-037) or the triage outcome of reporting and triaging in one step (ST-023, ST-052).
 */
export type MachineRecordConfirmation =
  | { kind: "status-changed" }
  | { kind: "moved" }
  | { kind: "problem-reported" }
  | { kind: "file-attached"; title: string }
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
  const asked = (["statusChanged", "moved", "problemReported"] as const).find((name) => query[name] !== undefined);
  if (!asked) return undefined;
  const command = await lastCommandBy(db, { machineId: record.id }, viewer);
  if (!command) return undefined;
  const changes = collectionChangesIn(command, record.id);
  if (asked === "statusChanged" && changes.statusChangedTo) return { kind: "status-changed" };
  if (asked === "moved" && changes.moved) return { kind: "moved" };
  if (asked === "problemReported" && problemReportedIn(command, record.id)) return { kind: "problem-reported" };
  return undefined;
}
