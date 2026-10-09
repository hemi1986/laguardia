import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { fixedClock } from "@/platform/clock";
import { executeCommand, journalOf, type Actor } from "@/platform/command";
import { testDatabase } from "@/test-support/database";
import { aRegisteredMachine } from "@/test-support/machines";
import { anExistingTeamMember } from "@/test-support/team-members";
import {
  defectDetails,
  linkProblemReportToDefectCommand,
  openDefects,
  problemReportForTriage,
  recordDefectCommand,
  reportProblemCommand,
} from ".";
import { resolveDefectForTest } from "./problem-report-stand-ins.test-support";

/** CMD-LinkProblemReportToDefect (ST-022) through the command layer – a triage outcome for technicians only. */
const db = testDatabase();
const clock = fixedClock("2026-10-09T10:00:00Z");
const eva = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;

async function reported(machineId: string, description: string) {
  const outcome = await executeCommand(
    reportProblemCommand,
    { machineId, description },
    { actor: { kind: "visitor" }, db, clock, newId: randomUUID },
  );
  if (!outcome.ok) throw new Error(outcome.error);
  return outcome.result.problemReportId;
}

/** An open defect of the machine, recorded from a problem report of its own. */
async function anOpenDefect(machineId: string, title: string) {
  await anExistingTeamMember(db, eva, "Eva");
  const outcome = await executeCommand(
    recordDefectCommand,
    {
      problemReportId: await reported(machineId, `${title} (first report)`),
      version: 0,
      title,
      priority: undefined,
      suitableForHelpers: false,
      machineStatus: undefined,
      machineVersion: undefined,
    },
    { actor: eva, db, clock, newId: randomUUID },
  );
  if (!outcome.ok) throw new Error(outcome.error);
  return outcome.result.defectId;
}

function link(problemReportId: string, defectId: string | undefined, actor: Actor = eva) {
  return executeCommand(
    linkProblemReportToDefectCommand,
    { problemReportId, version: 0, defectId },
    { actor, db, clock, newId: randomUUID },
  );
}

describe("CMD-LinkProblemReportToDefect", () => {
  it("ST-022: Technician links a problem report to an open defect", async () => {
    const lg042 = await aRegisteredMachine(db);
    const defectId = await anOpenDefect(lg042, "Left flipper weak");
    const problemReportId = await reported(lg042, "Flipper on the left does nothing");

    expect(await link(problemReportId, defectId)).toEqual({ ok: true, result: { problemReportId, defectId } });

    expect(await problemReportForTriage(db, clock, problemReportId)).toMatchObject({
      triageOutcome: "linked",
      triagedBy: eva.teamMemberId,
    });
    const [listed] = await openDefects(db, { machineId: lg042 });
    expect(listed).toMatchObject({ id: defectId, title: "Left flipper weak", linkedProblemReports: 1 });
    const details = await defectDetails(db, defectId);
    expect(details?.problemReports.map(({ id, originating }) => ({ id, originating }))).toContainEqual({
      id: problemReportId,
      originating: false,
    });
    const [entry] = (await journalOf(db, { aggregateId: problemReportId })).slice(-1);
    expect(entry).toMatchObject({
      type: "EVT-ProblemReportLinkedToDefect",
      machineId: lg042,
      actor: { kind: "team-member", teamMemberId: eva.teamMemberId, role: "technician" },
      data: { defectId },
    });
  });

  it("ST-022: Defect of another machine cannot be linked", async () => {
    const lg007 = await aRegisteredMachine(db);
    const lg042 = await aRegisteredMachine(db);
    const displayFlickers = await anOpenDefect(lg007, "Display flickers");
    const problemReportId = await reported(lg042, "Flipper on the left does nothing");

    expect(await link(problemReportId, displayFlickers)).toEqual({ ok: false, error: "defect-of-another-machine" });

    expect((await problemReportForTriage(db, clock, problemReportId))?.triageOutcome).toBeUndefined();
    expect((await openDefects(db, { machineId: lg007 }))[0]).toMatchObject({ linkedProblemReports: 0 });
  });

  it("ST-022: A defect resolved in the meantime cannot be linked", async () => {
    const lg042 = await aRegisteredMachine(db);
    const defectId = await anOpenDefect(lg042, "Left flipper weak");
    const problemReportId = await reported(lg042, "Flipper on the left does nothing");
    // The technician's page offered the open defect; a moment later it was resolved.
    const resolved = await executeCommand(
      resolveDefectForTest,
      { defectId, version: 0 },
      { actor: eva, db, clock, newId: randomUUID },
    );
    if (!resolved.ok) throw new Error(resolved.error);

    expect(await link(problemReportId, defectId)).toEqual({ ok: false, error: "defect-not-open" });

    expect((await problemReportForTriage(db, clock, problemReportId))?.triageOutcome).toBeUndefined();
    expect((await defectDetails(db, defectId))?.state).toBe("resolved");
  });

  it("rejects linking without a defect, or with one that does not exist", async () => {
    const lg042 = await aRegisteredMachine(db);
    await anOpenDefect(lg042, "Left flipper weak");
    const problemReportId = await reported(lg042, "Flipper on the left does nothing");

    expect(await link(problemReportId, undefined)).toEqual({ ok: false, error: "defect-required" });
    expect(await link(problemReportId, randomUUID())).toEqual({ ok: false, error: "defect-required" });
    expect(await link(problemReportId, "not-an-id")).toEqual({ ok: false, error: "defect-required" });
    expect((await problemReportForTriage(db, clock, problemReportId))?.triageOutcome).toBeUndefined();
  });
});
