/**
 * Where the form „Wartung erfassen“ was opened from, and so where it leads back to (ST-044, ST-047): the due maintenance
 * list or the machine record. A fixed choice – never an address taken from the request (no open redirect).
 */
export type RecordMaintenanceReturn = "list" | "machine";

/** The form page's address – `von=geraet` when it is opened from the machine record. */
export function recordMaintenanceAddress({
  maintenanceTaskId,
  museumNumber,
  back,
}: {
  maintenanceTaskId: string;
  museumNumber: string;
  back: RecordMaintenanceReturn;
}): string {
  const params = new URLSearchParams({ task: maintenanceTaskId, machine: museumNumber });
  if (back === "machine") params.set("von", "geraet");
  return `/team/maintenance/erfassen?${params.toString()}`;
}

/** The return the address or the form names – anything but the machine record is the due maintenance list. */
export function recordMaintenanceReturnOf(value: unknown): RecordMaintenanceReturn {
  return value === "geraet" || value === "machine" ? "machine" : "list";
}

/** Where the form's back link leads. */
export function backAddress(
  back: RecordMaintenanceReturn,
  { maintenanceTaskId, museumNumber }: { maintenanceTaskId: string; museumNumber: string },
): string {
  return back === "machine"
    ? `/team/machines/${encodeURIComponent(museumNumber)}`
    : `/team/maintenance?${new URLSearchParams({ task: maintenanceTaskId }).toString()}`;
}

/**
 * Where the team member lands after recording (G3): the machine record when its museum number is given, else the due
 * maintenance list at the same task – the address says only which record to confirm; the page confirms it from the
 * journal.
 */
export function recordedAddress({
  maintenanceRecordId,
  maintenanceTaskId,
  museumNumber,
}: {
  maintenanceRecordId: string;
  maintenanceTaskId: string;
  museumNumber?: string;
}): string {
  if (museumNumber !== undefined) {
    const params = new URLSearchParams({ maintenanceRecorded: maintenanceRecordId });
    return `/team/machines/${encodeURIComponent(museumNumber)}?${params.toString()}`;
  }
  const params = new URLSearchParams({ task: maintenanceTaskId, recorded: maintenanceRecordId });
  return `/team/maintenance?${params.toString()}`;
}
