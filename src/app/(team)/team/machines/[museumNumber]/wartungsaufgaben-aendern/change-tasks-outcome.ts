import "server-only";
import { machineLabels } from "@/modules/collection";
import { removedMaintenanceTaskNames } from "@/modules/maintenance";
import type { Database } from "@/platform/command";

/**
 * Where the technician lands after the change (G33): the machine record, which says how many maintenance tasks apply to
 * the machine now – also when nothing changed. The command names the machine; the address takes its museum number.
 */
export async function tasksChangedLanding(db: Database, { machineId }: { machineId: string }): Promise<string> {
  const museumNumber = (await machineLabels(db, [machineId])).get(machineId)?.museumNumber;
  return museumNumber ? `/team/machines/${encodeURIComponent(museumNumber)}?tasksChanged=1` : "/team/machines";
}

/**
 * A rejected change that names the maintenance tasks removed meanwhile (ST-096): their names, as the decision named them
 * as its subjects. Any other state comes back as it is.
 */
export async function withRemovedNamed<State extends { error: string; subjects?: readonly string[] }>(
  db: Database,
  state: State | null,
): Promise<(State & { removed?: readonly string[] }) | null> {
  if (state?.error !== "maintenance-task-removed" || !state.subjects) return state;
  return { ...state, removed: await removedMaintenanceTaskNames(db, state.subjects) };
}
