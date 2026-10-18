import type { ActorOf, Decision, DecisionContext } from "@/platform/command";
import {
  machineModelDetails,
  type CreateMachineModelError,
  type CreateMachineModelInput,
  type MachineCategory,
  type machineModelActors,
  type MachineModelState,
  type Technology,
} from "./create-machine-model";

/**
 * CMD-CorrectMachineModel (AGG-MachineModel, ST-036): a technician corrects a machine model's details – for all
 * machines of that model at once (HS-18). The same invariants as at creation; a correction that changes the machine
 * category or the technology appends to the category history, so Maintenance knows since when a task applies.
 */

type CorrectingPerson = ActorOf<(typeof machineModelActors)[number]>;

/** What the technician gave – the whole form, as at creation, with the version they saw (HS-16). */
export type CorrectMachineModelInput = CreateMachineModelInput & { machineModelId: string; version: number };

export type MachineModelCorrected = {
  type: "EVT-MachineModelCorrected";
  machineModelId: string;
  machineCategory: MachineCategory;
  technology?: Technology;
};

export type CorrectMachineModelError = CreateMachineModelError | "machine-model-unchanged";

export function correctMachineModel(
  model: MachineModelState,
  input: CorrectMachineModelInput,
  { clock, newId }: DecisionContext<CorrectingPerson>,
): Decision<MachineModelState, MachineModelCorrected, CorrectMachineModelError> {
  const checked = machineModelDetails(input);
  if (!checked.ok) return checked;
  const { details } = checked;
  const changed = (Object.keys(details) as (keyof typeof details)[]).filter((key) => details[key] !== model[key]);
  // No correction without a change (user, 2026-10-18, as ST-031).
  if (changed.length === 0) return { ok: false, error: "machine-model-unchanged" };
  const { machineCategory, technology } = details;
  const categoryChanged = machineCategory !== model.machineCategory || technology !== model.technology;
  return {
    ok: true,
    state: {
      ...model,
      ...details,
      categoryHistory: categoryChanged
        ? [...model.categoryHistory, { id: newId(), machineCategory, technology, holdsFrom: clock.now() }]
        : model.categoryHistory,
    },
    events: [{ type: "EVT-MachineModelCorrected", machineModelId: model.id, machineCategory, technology }],
  };
}
