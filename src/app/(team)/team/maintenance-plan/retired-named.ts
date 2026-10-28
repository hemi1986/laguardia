import { machineLabels } from "@/modules/collection";
import type { Database } from "@/platform/command";

/**
 * A rejected step that names the machines retired meanwhile (ST-094, ST-095): their museum numbers, in the order the
 * decision named them as its subjects – the decision says which ones, the page only says them in words. Any other
 * state comes back as it is.
 */
export async function withRetiredNamed<State extends { error: string; subjects?: readonly string[] }>(
  db: Database,
  state: State | null,
): Promise<(State & { retired?: readonly string[] }) | null> {
  if (state?.error !== "machine-retired" || !state.subjects) return state;
  const labels = await machineLabels(db, state.subjects);
  return { ...state, retired: state.subjects.flatMap((machineId) => labels.get(machineId)?.museumNumber ?? []) };
}
