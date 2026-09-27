import { aggregateCommand, created, trigger } from "@/platform/command";
import { problemReports } from "./problem-reports";
import { reportProblem } from "./report-problem";

/**
 * Test stand-ins for the triage commands to come (ST-018 ff.) – commands on an existing problem report.
 * Only imported by tests.
 */

/** Changes the description at the version the technician saw; rejects a change to the text it already has. */
export const changeDescriptionForTest = aggregateCommand({
  id: "CMD-TestChangeDescription",
  allowedActors: ["technician"],
  store: problemReports,
  target: (input: { problemReportId: string; version: number; description: string }) => ({
    id: input.problemReportId,
    version: input.version,
  }),
  decide: (state, input) =>
    state.description === input.description
      ? { ok: false as const, error: "description-unchanged" as const }
      : {
          ok: true as const,
          state: { ...state, description: input.description },
          events: [{ type: "EVT-TestDescriptionChanged" as const, problemReportId: state.id }],
        },
  journal: (event, state) => ({
    type: event.type,
    aggregate: { type: "AGG-ProblemReport", id: event.problemReportId },
    machineId: state.machineId,
    data: {},
  }),
  result: () => undefined,
});

/**
 * Splits a problem report: changes its description and creates a second problem report of the same module
 * (like recording a defect during triage, HS-16).
 */
export const splitForTest = aggregateCommand({
  id: "CMD-TestSplit",
  allowedActors: ["technician"],
  store: problemReports,
  target: (input: { problemReportId: string; version: number; splitOff: string }) => ({
    id: input.problemReportId,
    version: input.version,
  }),
  decide: (state, input, { newId }) => {
    const second = { ...state, id: newId(), description: input.splitOff };
    return {
      ok: true as const,
      state: { ...state, description: `${state.description} (split)` },
      events: [{ type: "EVT-TestSplit" as const, problemReportId: state.id, secondId: second.id }],
      created: [created(problemReports, second)],
    };
  },
  journal: (event, state) => ({
    type: event.type,
    aggregate: { type: "AGG-ProblemReport", id: event.problemReportId },
    machineId: state.machineId,
    data: { secondId: event.secondId },
  }),
  result: (state) => ({ problemReportId: state.id }),
});

/** A stand-in for the automatic policies (e.g. POL-RetirementClosesDefects): allowed for the system only. */
export const policyForTest = aggregateCommand({
  id: "CMD-TestPolicy",
  allowedActors: ["system"],
  store: problemReports,
  target: (input: { problemReportId: string; reject?: boolean }) => ({ id: input.problemReportId }),
  decide: (state, input) =>
    input.reject
      ? { ok: false as const, error: "policy-rejected" as const }
      : { ok: true as const, state, events: [{ type: "EVT-TestPolicyApplied" as const, problemReportId: state.id }] },
  journal: (event, state) => ({
    type: event.type,
    aggregate: { type: "AGG-ProblemReport", id: event.problemReportId },
    machineId: state.machineId,
    data: {},
  }),
  result: () => undefined,
});

/** Reports a problem like CMD-ReportProblem and triggers the stand-in policy afterwards. */
export const reportWithPolicyForTest = aggregateCommand({
  id: "CMD-TestReportWithPolicy",
  allowedActors: ["technician"],
  store: problemReports,
  creates: true,
  decide: reportProblem,
  journal: (event) => ({
    type: event.type,
    aggregate: { type: "AGG-ProblemReport", id: event.problemReportId },
    machineId: event.machineId,
    data: {},
  }),
  policies: (state) => [trigger(policyForTest, { problemReportId: state.id })],
  result: (state) => ({ problemReportId: state.id }),
});

/** Like reportWithPolicyForTest, but the triggered policy rejects – the whole command must be rejected. */
export const reportWithRejectedPolicyForTest = aggregateCommand({
  id: "CMD-TestReportWithRejectedPolicy",
  allowedActors: ["technician"],
  store: problemReports,
  creates: true,
  decide: reportProblem,
  journal: (event) => ({
    type: event.type,
    aggregate: { type: "AGG-ProblemReport", id: event.problemReportId },
    machineId: event.machineId,
    data: {},
  }),
  policies: (state) => [trigger(policyForTest, { problemReportId: state.id, reject: true })],
  result: (state) => ({ problemReportId: state.id }),
});
