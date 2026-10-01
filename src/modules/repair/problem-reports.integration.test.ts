import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { fixedClock } from "@/platform/clock";
import { executeCommand } from "@/platform/command";
import { testDatabase } from "@/test-support/database";
import { problemReportsOfMachine, reportProblemCommand } from ".";
import { aRegisteredMachine } from "@/test-support/machines";

describe("problem reports in PostgreSQL", () => {
  it("stores a reported problem at the time of the fixed clock and lists it for its machine", async () => {
    const db = testDatabase();
    const machineId = await aRegisteredMachine(db);
    const reported = await executeCommand(
      reportProblemCommand,
      { machineId, description: "Left flipper is weak" },
      { actor: { kind: "visitor" }, db, clock: fixedClock("2026-09-27T10:00:00Z"), newId: randomUUID },
    );
    if (!reported.ok) throw new Error(reported.error);

    expect(await problemReportsOfMachine(db, machineId)).toEqual([
      {
        id: reported.result.problemReportId,
        description: "Left flipper is weak",
        reportedAt: new Date("2026-09-27T10:00:00Z"),
      },
    ]);
  });
});
