import "server-only";
import type { ChoiceGroup } from "@/components/ui/grouped-choice";
import { removedMaintenanceTaskNames, type TaskGroup } from "@/modules/maintenance";
import type { Database } from "@/platform/command";
import { teamMessages } from "@/platform/messages";

const { changeTasks: texts, maintenancePlan } = teamMessages;

/**
 * The maintenance tasks of one machine as its forms show them (RM-MaintenanceTaskChoiceForMachine, G27): „Jeden Monat“,
 * „Alle 3 Monate“, …, a task suitable for helpers marked so. Shared by changing a machine's tasks (ST-096) and
 * registering a machine (ST-097).
 */
export function taskChoiceGroups(groups: TaskGroup[]): ChoiceGroup[] {
  return groups.map((group) => ({
    key: String(group.intervalMonths),
    label: maintenancePlan.every(group.intervalMonths),
    entries: group.tasks.map((task) => ({
      value: task.maintenanceTaskId,
      label: task.suitableForHelpers ? `${task.name} · ${texts.suitableForHelpers}` : task.name,
    })),
  }));
}

/**
 * A rejected step that names the maintenance tasks removed meanwhile (ST-096, ST-097): their names, as the decision named
 * them as its subjects. Any other state comes back as it is.
 */
export async function withRemovedNamed<State extends { error: string; subjects?: readonly string[] }>(
  db: Database,
  state: State | null,
): Promise<(State & { removed?: readonly string[] }) | null> {
  if (state?.error !== "maintenance-task-removed" || !state.subjects) return state;
  return { ...state, removed: await removedMaintenanceTaskNames(db, state.subjects) };
}
