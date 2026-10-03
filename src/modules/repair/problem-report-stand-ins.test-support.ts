import { changeMachineStatusCommand, type MachineStatus } from "@/modules/collection";
import { aggregateCommand, created, run, trigger, type Database } from "@/platform/command";
import { defects } from "./defects";
import { problemReports, reportingFacts } from "./problem-reports";
import { reportProblem, reportingActors, type ReportProblemInput } from "./report-problem";

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
  target: (input: { problemReportId: string; reject?: boolean; idle?: boolean }) => ({ id: input.problemReportId }),
  decide: (state, input) =>
    input.reject
      ? { ok: false as const, error: "policy-rejected" as const }
      : input.idle
        ? { ok: true as const, state, events: [] } // nothing to do
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
  facts: reportingFacts,
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
  facts: reportingFacts,
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

/** Like reportWithPolicyForTest, but the triggered policy has nothing to do. */
export const reportWithIdlePolicyForTest = aggregateCommand({
  id: "CMD-TestReportWithIdlePolicy",
  allowedActors: ["technician"],
  store: problemReports,
  creates: true,
  facts: reportingFacts,
  decide: reportProblem,
  journal: (event) => ({
    type: event.type,
    aggregate: { type: "AGG-ProblemReport", id: event.problemReportId },
    machineId: event.machineId,
    data: {},
  }),
  policies: (state) => [trigger(policyForTest, { problemReportId: state.id, idle: true })],
  result: (state) => ({ problemReportId: state.id }),
});

/** A team command that forgets to pass the version the technician saw – the layer must refuse it. */
export const changeWithoutVersionForTest = aggregateCommand({
  id: "CMD-TestChangeWithoutVersion",
  allowedActors: ["technician"],
  store: problemReports,
  target: (input: { problemReportId: string; description: string }) => ({ id: input.problemReportId }),
  decide: (state, input) => ({
    ok: true as const,
    state: { ...state, description: input.description },
    events: [{ type: "EVT-TestDescriptionChanged" as const, problemReportId: state.id }],
  }),
  journal: (event, state) => ({
    type: event.type,
    aggregate: { type: "AGG-ProblemReport", id: event.problemReportId },
    machineId: state.machineId,
    data: {},
  }),
  result: () => undefined,
});

/** A problem report as stored – for checks at the command seam that no read model shows yet (the reporter). */
export async function storedProblemReport(db: Database, problemReportId: string) {
  return (await problemReports.load(db, problemReportId))?.state;
}

/**
 * Test stand-in for the triage commands (ST-018 ff.): the problem report is triaged with the given outcome at the
 * version the technician saw – it leaves the untriaged lists.
 */
export const triageForTest = aggregateCommand({
  id: "CMD-TestTriage",
  allowedActors: ["technician"],
  store: problemReports,
  target: (input: { problemReportId: string; version: number }) => ({
    id: input.problemReportId,
    version: input.version,
  }),
  decide: (report, _input, { actor, clock }) => ({
    ok: true as const,
    state: {
      ...report,
      triage: { outcome: "dismissed" as const, triagedBy: actor.teamMemberId, triagedAt: clock.now() },
    },
    events: [{ type: "EVT-TestTriaged" as const }],
  }),
  journal: (event, report) => ({
    type: event.type,
    aggregate: { type: "AGG-ProblemReport", id: report.id },
    machineId: report.machineId,
    data: {},
  }),
  result: () => ({}),
});

/**
 * Test stand-in for `context.run` (ST-018): reports a problem like CMD-ReportProblem and then runs Collection's
 * CMD-ChangeMachineStatus as the same acting person, in the same transaction.
 */
export const reportAndChangeStatusForTest = aggregateCommand({
  id: "CMD-TestReportAndChangeStatus",
  allowedActors: reportingActors,
  store: problemReports,
  creates: true,
  facts: reportingFacts,
  decide: (
    facts,
    input: ReportProblemInput & { machineVersion: number; machineStatus: MachineStatus; reason: string },
    context,
  ) => reportProblem(facts, input, context),
  journal: (event) => ({
    type: event.type,
    aggregate: { type: "AGG-ProblemReport", id: event.problemReportId },
    machineId: event.machineId,
    data: {},
  }),
  runs: (report, _events, input) => [
    run(changeMachineStatusCommand, {
      machineId: report.machineId,
      version: input.machineVersion,
      machineStatus: input.machineStatus,
      reason: input.reason,
    }),
  ],
  result: (report) => ({ problemReportId: report.id }),
});

/** A defect as stored – for checks at the command seam before its own read models exist (ST-021). */
export async function storedDefect(db: Database, defectId: string) {
  return (await defects.load(db, defectId))?.state;
}
