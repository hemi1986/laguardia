import "server-only";
import type { ChoiceGroup } from "@/components/ui/grouped-choice";
import { machineModelsToChooseFrom, machineStatuses, type MachineStatus } from "@/modules/collection";
import { maintenanceTaskChoiceForNewMachine } from "@/modules/maintenance";
import type { Database } from "@/platform/command";
import { teamMessages } from "@/platform/messages";
import { machineKindLabel } from "../../maintenance-plan/choice-groups";
import { taskChoiceGroups } from "../task-choice";

const { machines: texts, registration } = teamMessages;

/** What the registration form proposes for one machine model (ST-097): the tasks to tick, and the line saying why. */
export type Proposal = { tasks: string[]; line: string };

/** What the registration page offers (ST-007, ST-097) – built here, so the client form imports no module code. */
export type RegistrationChoices = {
  machineModels: { value: string; label: string }[];
  machineStatuses: { value: MachineStatus; label: string }[];
  /** Every maintenance task of the plan in groups by interval (G27) – none ticked. */
  tasks: ChoiceGroup[];
  /** By machine model ID; a model with nothing to propose has none. */
  proposals: Record<string, Proposal>;
};

/**
 * The registration page's data: the machine models and statuses to choose from (Collection), and the maintenance tasks
 * with what each machine model proposes (Maintenance, RM-MaintenanceTaskChoiceForMachine) – the page composes them.
 */
export async function loadRegistration(db: Database): Promise<RegistrationChoices> {
  const models = await machineModelsToChooseFrom(db);
  const { groups, proposedFor } = await maintenanceTaskChoiceForNewMachine(db, models);
  const proposals: Record<string, Proposal> = {};
  for (const model of models) {
    const tasks = proposedFor[model.id];
    if (tasks)
      proposals[model.id] = {
        tasks,
        line: registration.proposed(tasks.length, machineKindLabel(model.machineCategory, model.technology)),
      };
  }
  return {
    // "Medieval Madness (Williams, 1997)" – the manufacturer and year tell models with the same title apart.
    machineModels: models.map((model) => ({
      value: model.id,
      label: `${model.title} (${[model.manufacturer, model.year].filter(Boolean).join(", ")})`,
    })),
    machineStatuses: machineStatuses.map((status) => ({ value: status, label: texts.statuses[status] })),
    tasks: taskChoiceGroups(groups),
    proposals,
  };
}
