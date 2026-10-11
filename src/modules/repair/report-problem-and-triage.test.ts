import { describe, expect, it } from "vitest";
import { fixedClock } from "@/platform/clock";
import type { MachineStatus } from "@/modules/collection";
import { reportProblemAndTriage, type TriageInTheSameStep } from "./report-problem-and-triage";

/**
 * CMD-ReportProblem with its triage outcome in the same step (ST-023) – the decision's table: who sends what, and which
 * rejection comes first. It also pins what `reportProblemCommand`'s narrower type claims: without a triage part the
 * only rejections are those of reporting and `triage-required`.
 */
const visitor = { kind: "visitor" } as const;
const helper = { kind: "team-member", teamMemberId: "anna", role: "helper" } as const;
const technician = { kind: "team-member", teamMemberId: "tom", role: "technician" } as const;

const defect = (title: string, machineStatus?: MachineStatus): TriageInTheSameStep => ({
  outcome: "defect-recorded",
  title,
  priority: undefined,
  suitableForHelpers: false,
  machineStatus,
  machineVersion: machineStatus && 0,
});

const resolved = (note: string): TriageInTheSameStep => ({ outcome: "resolved-on-the-spot", note });
const linked = (defectId?: string): TriageInTheSameStep => ({ outcome: "linked", defectId });

type Facts = Parameters<typeof reportProblemAndTriage>[0];

const machine = (machineStatus: MachineStatus, retired = false): Facts => ({
  machine: { machineStatus, retired },
  defect: undefined,
});
/** The chosen defect as stored now – the decision's machine is always "m-1". */
const withDefect = (state: "open" | "resolved", machineId = "m-1"): Facts => ({
  ...machine("playable"),
  defect: { id: "d-1", machineId, state },
});

function decide(
  actor: typeof visitor | typeof helper | typeof technician,
  description: string,
  triage?: TriageInTheSameStep,
  facts: Facts = machine("playable"),
) {
  let id = 0;
  const decision = reportProblemAndTriage(
    facts,
    { machineId: "m-1", description, triage },
    { actor, clock: fixedClock("2026-10-11T09:00:00Z"), newId: () => `id-${++id}` },
  );
  return decision.ok ? decision.events.map((event) => event.type) : decision.error;
}

describe("CMD-ReportProblem with a triage outcome in the same step – the decision", () => {
  it.each([
    ["a visitor without a triage part", visitor, "Ball stuck", undefined, ["EVT-ProblemReported"]],
    ["a helper without a triage part", helper, "Ball stuck", undefined, ["EVT-ProblemReported"]],
    ["a visitor with a defect", visitor, "Ball stuck", defect("Ball trap"), "not-authorized"],
    ["a helper with a defect", helper, "Ball stuck", defect("Ball trap"), "not-authorized"],
    ["a helper with a defect and no description", helper, " ", defect("Ball trap"), "not-authorized"],
    ["a technician without a triage part", technician, "Ball stuck", undefined, "triage-required"],
    [
      "a technician with a defect",
      technician,
      "Ball stuck",
      defect("Ball trap"),
      ["EVT-ProblemReported", "EVT-DefectRecorded"],
    ],
    [
      "a technician with a defect and a stricter status",
      technician,
      "Ball stuck",
      defect("Ball trap", "limited"),
      ["EVT-ProblemReported", "EVT-DefectRecorded"],
    ],
    ["no description, no title", technician, " ", defect(" "), "description-required"],
    ["a description of 2001 characters, no title", technician, "x".repeat(2001), defect(" "), "description-too-long"],
    ["a description, no title", technician, "Ball stuck", defect(" "), "title-required"],
    [
      "a status that is not stricter",
      technician,
      "Ball stuck",
      defect("Ball trap", "playable"),
      "machine-status-not-stricter",
    ],
  ] as const)("%s → %j", (_case, actor, description, triage, expected) => {
    expect(decide(actor, description, triage)).toEqual(expected);
  });

  it("checks the machine before anything of the triage outcome", () => {
    expect(decide(technician, " ", defect(" "), machine("playable", true))).toBe("machine-retired");
    expect(decide(technician, "Ball stuck", defect("Ball trap"), { machine: undefined, defect: undefined })).toBe(
      "machine-not-found",
    );
    // Team members report for a machine not on display (ST-015) – a technician with a defect, whose status stays.
    expect(decide(technician, "Ball stuck", defect("Ball trap"), machine("not-on-display"))).toEqual([
      "EVT-ProblemReported",
      "EVT-DefectRecorded",
    ]);
    expect(decide(technician, "Ball stuck", defect("Ball trap", "out-of-order"), machine("not-on-display"))).toBe(
      "machine-status-not-stricter",
    );
  });

  it.each([
    [
      "a helper who resolved it on the spot",
      helper,
      "Ball stuck",
      resolved("Ball freed"),
      ["EVT-ProblemReported", "EVT-ProblemResolvedOnTheSpot"],
    ],
    [
      "a technician who resolved it on the spot",
      technician,
      "Ball stuck",
      resolved("Ball freed"),
      ["EVT-ProblemReported", "EVT-ProblemResolvedOnTheSpot"],
    ],
    ["a visitor who resolved it on the spot", visitor, "Ball stuck", resolved("Ball freed"), "not-authorized"],
    ["resolved on the spot without a note", helper, "Ball stuck", resolved(" "), "note-required"],
    ["no description, no note", helper, " ", resolved(" "), "description-required"],
    ["a helper who links", helper, "Ball stuck", linked("d-1"), "not-authorized"],
    ["a visitor who links", visitor, "Ball stuck", linked("d-1"), "not-authorized"],
  ] as const)("%s → %j", (_case, actor, description, triage, expected) => {
    expect(decide(actor, description, triage, withDefect("open"))).toEqual(expected);
  });

  it.each([
    ["an open defect of the machine", withDefect("open"), ["EVT-ProblemReported", "EVT-ProblemReportLinkedToDefect"]],
    ["no defect chosen, or an unknown one", machine("playable"), "defect-required"],
    ["a defect resolved in the meantime", withDefect("resolved"), "defect-not-open"],
    ["a defect of another machine", withDefect("open", "m-2"), "defect-of-another-machine"],
  ] as const)("a technician links to %s → %j", (_case, facts, expected) => {
    expect(decide(technician, "Ball stuck", linked("d-1"), facts)).toEqual(expected);
  });

  it("names the missing description before anything of the link", () => {
    expect(decide(technician, " ", linked(undefined), machine("playable"))).toBe("description-required");
  });

  it("stores the technician's problem report already triaged, with the new defect", () => {
    const decision = reportProblemAndTriage(
      machine("playable"),
      { machineId: "m-1", description: "Ball stuck", triage: defect("Ball trap") },
      {
        actor: technician,
        clock: fixedClock("2026-10-11T09:00:00Z"),
        newId: (() => {
          let id = 0;
          return () => `id-${++id}`;
        })(),
      },
    );

    if (!decision.ok) throw new Error(decision.error);
    expect(decision.state.triage).toEqual({
      outcome: "defect-recorded",
      triagedBy: "tom",
      triagedAt: new Date("2026-10-11T09:00:00Z"),
      defectId: "id-2",
    });
    expect(decision.created).toHaveLength(1);
  });
});
