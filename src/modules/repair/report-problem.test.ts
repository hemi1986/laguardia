import { describe, expect, it } from "vitest";
import { fixedClock } from "@/platform/clock";
import { reportProblem } from "./report-problem";

const visitor = { kind: "visitor" } as const;
const context = { actor: visitor, clock: fixedClock("2026-09-27T10:00:00Z"), newId: () => "report-1" };

describe("CMD-ReportProblem – the decision", () => {
  it("records the problem report with its ID, machine, trimmed description, reporter and time", () => {
    const decision = reportProblem(
      undefined,
      { machineId: "test-machine", description: "  Left flipper is weak  " },
      context,
    );

    const report = {
      id: "report-1",
      machineId: "test-machine",
      description: "Left flipper is weak",
      reporter: { kind: "visitor" },
      reportedAt: new Date("2026-09-27T10:00:00Z"),
    };
    expect(decision).toEqual({
      ok: true,
      state: report,
      events: [
        {
          type: "EVT-ProblemReported",
          problemReportId: "report-1",
          machineId: "test-machine",
          description: "Left flipper is weak",
          reporter: { kind: "visitor" },
          reportedAt: new Date("2026-09-27T10:00:00Z"),
        },
      ],
    });
  });

  it("takes the acting team member as the reporter", () => {
    const actor = { kind: "team-member", teamMemberId: "tm-1", role: "helper" } as const;

    const decision = reportProblem(undefined, { machineId: "m-1", description: "Tilt" }, { ...context, actor });

    expect(decision.ok && decision.state.reporter).toEqual({ kind: "team-member", teamMemberId: "tm-1" });
  });

  it.each(["", "   ", "\n\t"])("rejects a problem report without a description (%j)", (description) => {
    expect(reportProblem(undefined, { machineId: "test-machine", description }, context)).toEqual({
      ok: false,
      error: "description-required",
    });
  });
});
