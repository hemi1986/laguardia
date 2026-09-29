import { aggregateCommand, type AggregateStore } from "@/platform/command";
import type { FormFields } from "./form-runner";

/**
 * Test stand-in for the forms to come whose fields are not free text (ST-007: a machine model ID; enumerations
 * like a priority). Only imported by tests. The command only ever rejects in these tests, so its store refuses to save.
 */
export type Urgency = "high" | "low";

export type ReportWithUrgencyInput = { machineId: string | undefined; urgency: Urgency | undefined };

const neverSaved: AggregateStore<{ id: string }> = {
  type: "AGG-TestNeverSaved",
  load: () => Promise.reject(new Error("the stand-in never loads")),
  insert: () => Promise.reject(new Error("the stand-in never saves")),
  update: () => Promise.reject(new Error("the stand-in never saves")),
};

/** Machine and urgency are required – like CMD-RegisterMachine rejecting a registration without a machine model. */
export const reportWithUrgencyForTest = aggregateCommand({
  id: "CMD-TestReportWithUrgency",
  allowedActors: ["visitor", "helper", "technician"],
  store: neverSaved,
  creates: true,
  decide: (_nothingYet, input: ReportWithUrgencyInput, { newId }) =>
    input.machineId === undefined || input.urgency === undefined
      ? { ok: false as const, error: "machine-required" as const }
      : { ok: true as const, state: { id: newId() }, events: [{ type: "EVT-TestReportedWithUrgency" as const }] },
  journal: (event, state) => ({
    type: event.type,
    aggregate: { type: "AGG-TestNeverSaved", id: state.id },
    machineId: null,
    data: {},
  }),
  result: () => undefined,
});

export const reportWithUrgencyFields = ["machineId", "urgency"] as const;

/** The input function of the stand-in form (Q19): a missing field is "no value given" – never a default. */
export function reportWithUrgencyInput(
  fields: FormFields<(typeof reportWithUrgencyFields)[number]>,
): ReportWithUrgencyInput {
  const urgency = fields.urgency;
  return {
    machineId: fields.machineId || undefined,
    urgency: urgency === "high" || urgency === "low" ? urgency : undefined,
  };
}
