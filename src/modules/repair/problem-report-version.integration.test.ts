import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { fixedClock } from "@/platform/clock";
import { defineCommand, executeCommand, journalOf, updateAtVersion, type Actor } from "@/platform/command";
import { testDatabase } from "@/test-support/database";
import { reportProblemCommand } from ".";
import { problemReport } from "./schema";

const db = testDatabase();
const technician: Actor = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" };
const deps = { actor: technician, db, clock: fixedClock("2026-09-27T10:00:00Z"), newId: randomUUID };

/** A stand-in for the triage commands (ST-018 ff.): changes a problem report at the version the technician saw. */
const changeDescriptionForTest = defineCommand({
  id: "CMD-TestChangeDescription",
  allowedActors: ["technician"],
  run: async (input: { problemReportId: string; version: number; description: string }, { tx }) => {
    await updateAtVersion(tx, problemReport, input.problemReportId, input.version, { description: input.description });
    return {
      ok: true as const,
      result: undefined,
      events: [
        {
          type: "EVT-TestDescriptionChanged",
          aggregate: { type: "AGG-ProblemReport", id: input.problemReportId },
          machineId: null,
          data: { description: input.description },
        },
      ],
    };
  },
});

describe("optimistic version check on the problem report (HS-16)", () => {
  it("lets exactly one of two concurrent commands on the same aggregate version succeed", async () => {
    const created = await executeCommand(
      reportProblemCommand,
      { machineId: randomUUID(), description: "Display flickers" },
      deps,
    );
    if (!created.ok) throw new Error(created.error);
    const { problemReportId } = created.result;

    const outcomes = await Promise.all(
      ["A", "B"].map((description) =>
        executeCommand(changeDescriptionForTest, { problemReportId, version: 0, description }, deps),
      ),
    );

    expect(outcomes.filter((o) => o.ok)).toHaveLength(1);
    expect(outcomes.filter((o) => !o.ok)).toEqual([{ ok: false, error: "version-conflict" }]);
    expect((await journalOf(db, { aggregateId: problemReportId })).map((e) => e.type)).toEqual([
      "EVT-ProblemReported",
      "EVT-TestDescriptionChanged",
    ]);
  });

  it("rejects a change of a problem report that does not exist as not found, not as a version conflict", async () => {
    const outcome = await executeCommand(
      changeDescriptionForTest,
      { problemReportId: randomUUID(), version: 0, description: "A" },
      deps,
    );

    expect(outcome).toEqual({ ok: false, error: "not-found" });
  });
});
