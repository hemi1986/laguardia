import { describe, expect, it } from "vitest";
import { reportProblem } from "./report-problem";

const reportedAt = new Date("2026-09-27T10:00:00Z");

describe("CMD-ReportProblem", () => {
  it("records the problem report with machine, trimmed description, reporter and time", () => {
    const result = reportProblem(
      { machineId: "test-machine", description: "  Left flipper is weak  ", reporter: { kind: "visitor" } },
      reportedAt,
    );

    expect(result).toEqual({
      ok: true,
      event: {
        type: "EVT-ProblemReported",
        machineId: "test-machine",
        description: "Left flipper is weak",
        reporter: { kind: "visitor" },
        reportedAt,
      },
    });
  });

  it.each(["", "   ", "\n\t"])("rejects a problem report without a description (%j)", (description) => {
    const result = reportProblem({ machineId: "test-machine", description, reporter: { kind: "visitor" } }, reportedAt);

    expect(result).toEqual({ ok: false, error: "description-required" });
  });
});
