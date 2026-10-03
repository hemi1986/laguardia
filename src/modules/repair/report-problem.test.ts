import { describe, expect, it } from "vitest";
import { fixedClock } from "@/platform/clock";
import { visitorMessages } from "@/platform/messages";
import { DESCRIPTION_MAX_LENGTH, reportProblem } from "./report-problem";

const visitor = { kind: "visitor" } as const;
const context = { actor: visitor, clock: fixedClock("2026-09-27T10:00:00Z"), newId: () => "report-1" };
const onDisplay = { machine: { machineStatus: "playable", retired: false } } as const;

describe("CMD-ReportProblem – the decision", () => {
  it("records the problem report with its ID, machine, trimmed description, reporter and time", () => {
    const decision = reportProblem(
      onDisplay,
      { machineId: "m-1", description: "  Left flipper is weak  " },
      context,
    );

    const report = {
      id: "report-1",
      machineId: "m-1",
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
          machineId: "m-1",
          description: "Left flipper is weak",
          reporter: { kind: "visitor" },
          reportedAt: new Date("2026-09-27T10:00:00Z"),
        },
      ],
    });
  });

  it("takes the acting team member as the reporter", () => {
    const actor = { kind: "team-member", teamMemberId: "tm-1", role: "helper" } as const;

    const decision = reportProblem(onDisplay, { machineId: "m-1", description: "Tilt" }, { ...context, actor });

    expect(decision.ok && decision.state.reporter).toEqual({ kind: "team-member", teamMemberId: "tm-1" });
  });

  it.each(["", "   ", "\n\t"])("rejects a problem report without a description (%j)", (description) => {
    expect(reportProblem(onDisplay, { machineId: "m-1", description }, context)).toEqual({
      ok: false,
      error: "description-required",
    });
  });

  it("names the longest description it accepts in both visitor languages", () => {
    for (const locale of ["de", "en"] as const) {
      expect(visitorMessages(locale).commandErrors["description-too-long"]).toContain(String(DESCRIPTION_MAX_LENGTH));
    }
  });

  // Who may report for which machine (CMD-ReportProblem rules, ST-013, ST-015).
  it.each([
    ["visitor", "playable", false, true],
    ["visitor", "not-on-display", false, "machine-not-on-display"],
    ["visitor", "playable", true, "machine-retired"],
    ["helper", "not-on-display", false, true],
    ["helper", "limited", true, "machine-retired"],
    ["technician", "out-of-order", false, true],
    ["technician", "not-on-display", true, "machine-retired"],
  ] as const)("a %s, a %s machine, retired: %s → %s", (who, machineStatus, retired, expected) => {
    const actor = who === "visitor" ? visitor : ({ kind: "team-member", teamMemberId: "tm-1", role: who } as const);
    const decision = reportProblem(
      { machine: { machineStatus, retired } },
      { machineId: "m-1", description: "Ball stuck" },
      { ...context, actor },
    );

    expect(decision.ok ? true : decision.error).toBe(expected);
  });
});
