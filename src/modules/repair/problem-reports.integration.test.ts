import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { fixedClock } from "@/clock";
import { testDatabase } from "@/test-support/database";
import { problemReportsOfMachine, saveProblemReported } from "./problem-reports";
import { reportProblem } from "./report-problem";

describe("problem reports in PostgreSQL", () => {
  it("stores a reported problem at the time of the fixed clock and lists it for its machine", async () => {
    const db = testDatabase();
    const machineId = randomUUID();
    const result = reportProblem(
      { machineId, description: "Left flipper is weak", reporter: { kind: "visitor" } },
      { clock: fixedClock("2026-09-27T10:00:00Z"), newId: randomUUID },
    );
    if (!result.ok) throw new Error(result.error);

    await saveProblemReported(db, result.event);

    expect(await problemReportsOfMachine(db, machineId)).toEqual([
      {
        id: result.event.problemReportId,
        description: "Left flipper is weak",
        reportedAt: new Date("2026-09-27T10:00:00Z"),
      },
    ]);
  });
});
