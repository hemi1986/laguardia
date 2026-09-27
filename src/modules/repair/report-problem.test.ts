import { describe, expect, it } from "vitest";
import { fixedClock } from "@/clock";
import { reportProblem } from "./report-problem";

const context = { clock: fixedClock("2026-09-27T10:00:00Z"), newId: () => "report-1" };

describe("CMD-ReportProblem", () => {
  it("records the problem report with its ID, machine, trimmed description, reporter and time", () => {
    const result = reportProblem(
      { machineId: "test-machine", description: "  Left flipper is weak  ", reporter: { kind: "visitor" } },
      context,
    );

    expect(result).toEqual({
      ok: true,
      event: {
        type: "EVT-ProblemReported",
        problemReportId: "report-1",
        machineId: "test-machine",
        description: "Left flipper is weak",
        reporter: { kind: "visitor" },
        reportedAt: new Date("2026-09-27T10:00:00Z"),
      },
    });
  });

  it.each(["", "   ", "\n\t"])("rejects a problem report without a description (%j)", (description) => {
    const result = reportProblem({ machineId: "test-machine", description, reporter: { kind: "visitor" } }, context);

    expect(result).toEqual({ ok: false, error: "description-required" });
  });
});
