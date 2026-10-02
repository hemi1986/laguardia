import { aggregateCommand, type AggregateStore } from "@/platform/command";
import type { FormFields } from "./form-runner";

/**
 * Test stand-in for the forms to come whose fields are not free text (ST-007: a required machine model ID and an
 * optional museum number; enumerations like a defect's priority). Only imported by tests. The command only ever
 * rejects in these tests, so its store refuses to save.
 */
export type Priority = "high" | "normal" | "low";

export type ReportWithPriorityInput = { machineModelId: string | undefined; priority: Priority | undefined };

const neverSaved: AggregateStore<{ id: string }> = {
  type: "AGG-TestNeverSaved",
  load: () => Promise.reject(new Error("the stand-in never loads")),
  insert: () => Promise.reject(new Error("the stand-in never saves")),
  update: () => Promise.reject(new Error("the stand-in never saves")),
};

/**
 * The machine model is required – like CMD-RegisterMachine rejecting a registration without one. The priority
 * is optional: without one the decision (not the input function) takes the default priority normal.
 */
export const reportWithPriorityForTest = aggregateCommand({
  id: "CMD-TestReportWithPriority",
  allowedActors: ["visitor", "helper", "technician"],
  store: neverSaved,
  creates: true,
  decide: (_nothingYet, input: ReportWithPriorityInput, { newId }) =>
    input.machineModelId === undefined
      ? { ok: false as const, error: "machine-model-required" as const }
      : {
          ok: true as const,
          state: { id: newId() },
          events: [{ type: "EVT-TestReportedWithPriority" as const, priority: input.priority ?? "normal" }],
        },
  journal: (event, state) => ({
    type: event.type,
    aggregate: { type: "AGG-TestNeverSaved", id: state.id },
    machineId: null,
    data: { priority: event.priority },
  }),
  result: () => undefined,
});

export const reportWithPriorityFields = ["machineModelId", "priority"] as const;

/** The input function of the stand-in form (Q19): a missing field is "no value given" – never a default. */
export function reportWithPriorityInput(
  fields: FormFields<(typeof reportWithPriorityFields)[number]>,
): ReportWithPriorityInput {
  const priority = fields.priority;
  return {
    machineModelId: fields.machineModelId || undefined,
    priority: priority === "high" || priority === "normal" || priority === "low" ? priority : undefined,
  };
}
