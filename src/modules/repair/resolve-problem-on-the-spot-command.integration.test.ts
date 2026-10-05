import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { fixedClock } from "@/platform/clock";
import { executeCommand, journalOf, type Actor } from "@/platform/command";
import { testDatabase } from "@/test-support/database";
import { aRegisteredMachine, journalSinceRegistration } from "@/test-support/machines";
import { anExistingTeamMember } from "@/test-support/team-members";
import { reportProblemCommand, resolveProblemOnTheSpotCommand, triageList } from ".";
import { storedProblemReport } from "./problem-report-stand-ins.test-support";

/** CMD-ResolveProblemOnTheSpot (ST-019) through the command layer – a triage outcome helpers may choose too. */
const db = testDatabase();
const clock = fixedClock("2026-10-05T10:00:00Z");
const anna = { kind: "team-member", teamMemberId: randomUUID(), role: "helper" } as const;

async function anUntriagedProblemReport(machineId: string, description = "Ball stuck behind the left ramp") {
  const reported = await executeCommand(
    reportProblemCommand,
    { machineId, description },
    { actor: { kind: "visitor" }, db, clock, newId: randomUUID },
  );
  if (!reported.ok) throw new Error(reported.error);
  return reported.result.problemReportId;
}

function resolveOnTheSpot(problemReportId: string, note: string, actor: Actor = anna) {
  return executeCommand(
    resolveProblemOnTheSpotCommand,
    { problemReportId, version: 0, note },
    { actor, db, clock, newId: randomUUID },
  );
}

describe("CMD-ResolveProblemOnTheSpot", () => {
  it("ST-019: Helper resolves a problem on the spot", async () => {
    await anExistingTeamMember(db, anna, "Anna");
    const machineId = await aRegisteredMachine(db);
    const problemReportId = await anUntriagedProblemReport(machineId);

    const resolved = await resolveOnTheSpot(problemReportId, "  Ball freed, ramp OK ");

    expect(resolved).toEqual({ ok: true, result: { problemReportId } });
    expect((await storedProblemReport(db, problemReportId))?.triage).toEqual({
      outcome: "resolved-on-the-spot",
      triagedBy: anna.teamMemberId,
      triagedAt: new Date("2026-10-05T10:00:00Z"),
      note: "Ball freed, ramp OK",
    });
    // No defect is created: the problem report's only triage event is this one – and the note stays out of the journal.
    expect((await journalSinceRegistration(db, machineId)).map((entry) => entry.type)).toEqual([
      "EVT-ProblemReported",
      "EVT-ProblemResolvedOnTheSpot",
    ]);
    const [entry] = (await journalOf(db, { aggregateId: problemReportId })).slice(-1);
    expect(entry).toMatchObject({
      type: "EVT-ProblemResolvedOnTheSpot",
      machineId,
      actor: { kind: "team-member", teamMemberId: anna.teamMemberId, role: "helper" },
      data: {},
    });
    expect((await triageList(db, clock)).map((listed) => listed.id)).not.toContain(problemReportId);
  });

  it("rejects a resolution without a note – the problem report stays untriaged", async () => {
    await anExistingTeamMember(db, anna, "Anna");
    const machineId = await aRegisteredMachine(db);
    const problemReportId = await anUntriagedProblemReport(machineId);

    expect(await resolveOnTheSpot(problemReportId, "   ")).toEqual({ ok: false, error: "note-required" });
    expect((await storedProblemReport(db, problemReportId))?.triage).toBeUndefined();
    expect((await triageList(db, clock)).map((listed) => listed.id)).toContain(problemReportId);
  });

  it("is refused for visitors", async () => {
    const machineId = await aRegisteredMachine(db);
    const problemReportId = await anUntriagedProblemReport(machineId);

    expect(await resolveOnTheSpot(problemReportId, "Ball freed", { kind: "visitor" })).toEqual({
      ok: false,
      error: "not-authorized",
    });
  });
});
