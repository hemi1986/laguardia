import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { fixedClock } from "@/platform/clock";
import { executeCommand, journalOf, type Actor } from "@/platform/command";
import { testDatabase } from "@/test-support/database";
import { aRegisteredMachine } from "@/test-support/machines";
import { anExistingTeamMember } from "@/test-support/team-members";
import { aDefectWithHistory } from "@/test-support/defects";
import {
  changeMachineStatusCommand,
  machineForTeamForm,
  machineLabels,
  machineRecord,
  statusHistoryOfMachine,
} from "@/modules/collection";
import {
  defectDetails,
  linkProblemReportToDefectCommand,
  openDefects,
  problemReportForTriage,
  recordDefectCommand,
  reportProblemCommand,
  resolveDefectCommand,
} from ".";

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
      resolveDefectCommand,
      { defectId, version: 0, closingNote: "Fixed" },
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

/** POL-LinkReopensResolvedDefect (ST-053): linking to a recently resolved defect reopens it, in the same step. */
describe("CMD-LinkProblemReportToDefect on a resolved defect", () => {
  const linkedAt = fixedClock("2026-10-15T10:00:00Z");

  /** „Left flipper weak“, resolved three days before the link, on a Playable or Out of order machine of its own. */
  async function aResolvedDefect(machineStatus: "playable" | "out-of-order" = "playable") {
    await anExistingTeamMember(db, eva, "Eva");
    const defect = await aDefectWithHistory(db, { by: eva, recordedAt: "2026-10-01T10:00:00Z" });
    if (machineStatus !== "playable") await setStatus(defect.machineId, machineStatus);
    await defect.resolve("2026-10-12T10:00:00Z");
    return defect;
  }

  async function machineOf(machineId: string) {
    const label = (await machineLabels(db, [machineId])).get(machineId);
    const machine = label && (await machineForTeamForm(db, label.museumNumber));
    if (!machine) throw new Error("no machine");
    return machine;
  }

  async function setStatus(machineId: string, machineStatus: "out-of-order") {
    const changed = await executeCommand(
      changeMachineStatusCommand,
      { machineId, version: (await machineOf(machineId)).version, machineStatus, reason: "Unsafe" },
      { actor: eva, db, clock, newId: randomUUID },
    );
    if (!changed.ok) throw new Error(changed.error);
  }

  /** Links a problem report as the page offered the defect: recently resolved, at the version shown. */
  async function linkResolved(
    problemReportId: string,
    defectId: string,
    status: { machineStatus?: "limited" | "out-of-order"; machineVersion?: number } = {},
  ) {
    return executeCommand(
      linkProblemReportToDefectCommand,
      {
        problemReportId,
        version: 0,
        defectId,
        resolvedDefectVersion: (await defectDetails(db, defectId))?.version,
        ...status,
      },
      { actor: eva, db, clock: linkedAt, newId: randomUUID },
    );
  }

  it("ST-053: Link and machine status change in the same step", async () => {
    const { machineId, defectId } = await aResolvedDefect();
    const problemReportId = await reported(machineId, "Left flipper does nothing again");

    const linked = await linkResolved(problemReportId, defectId, {
      machineStatus: "out-of-order",
      machineVersion: (await machineOf(machineId)).version,
    });

    expect(linked).toEqual({ ok: true, result: { problemReportId, defectId } });
    expect(await defectDetails(db, defectId)).toMatchObject({
      state: "open",
      reopenings: [
        {
          problemReport: { id: problemReportId, description: "Left flipper does nothing again" },
          reopenedBy: eva.teamMemberId,
          reopenedAt: linkedAt.now(),
        },
      ],
    });
    const record = await machineRecord(db, (await machineOf(machineId)).museumNumber);
    expect(record?.machineStatus).toBe("out-of-order");
    expect((await statusHistoryOfMachine(db, record!.id))[0]).toMatchObject({
      previousStatus: "playable",
      newStatus: "out-of-order",
      reason: "Left flipper weak",
      changedBy: eva.teamMemberId,
    });
    // Link, reopening and status change happened together, in that order.
    const steps = (await journalOf(db, { machineId })).slice(-3);
    expect(steps.map((entry) => entry.type)).toEqual([
      "EVT-ProblemReportLinkedToDefect",
      "EVT-DefectReopened",
      "EVT-MachineStatusChanged",
    ]);
  });

  it("ST-053: Only a stricter machine status when linking reopens", async () => {
    const { machineId, defectId } = await aResolvedDefect("out-of-order");
    const problemReportId = await reported(machineId, "Left flipper does nothing again");

    const rejected = await linkResolved(problemReportId, defectId, {
      machineStatus: "limited",
      machineVersion: (await machineOf(machineId)).version,
    });

    expect(rejected).toEqual({ ok: false, error: "machine-status-not-stricter" });
    expect((await defectDetails(db, defectId))?.state).toBe("resolved");
    expect((await machineOf(machineId)).machineStatus).toBe("out-of-order");
    expect((await problemReportForTriage(db, clock, problemReportId))?.triageOutcome).toBeUndefined();
  });

  it("ST-053: Link fails, nothing is reopened", async () => {
    const { machineId, defectId } = await aResolvedDefect();
    const problemReportId = await reported(machineId, "Left flipper does nothing again");
    // Another technician triaged the problem report a moment ago – as a new defect.
    const first = await executeCommand(
      recordDefectCommand,
      {
        problemReportId,
        version: 0,
        title: "Left flipper dead",
        priority: undefined,
        suitableForHelpers: false,
        machineStatus: undefined,
        machineVersion: undefined,
      },
      { actor: eva, db, clock, newId: randomUUID },
    );
    if (!first.ok) throw new Error(first.error);

    expect(await linkResolved(problemReportId, defectId)).toEqual({ ok: false, error: "already-triaged" });
    expect((await defectDetails(db, defectId))?.state).toBe("resolved");
    expect((await defectDetails(db, defectId))?.reopenings).toEqual([]);
  });

  it("rejects a defect resolved more than 30 days ago, and a status without a reopening", async () => {
    const { machineId, defectId } = await aResolvedDefect();
    const problemReportId = await reported(machineId, "Left flipper does nothing again");
    const later = { actor: eva, db, newId: randomUUID };
    const version = (await defectDetails(db, defectId))?.version;
    // Resolved on 12 October (Berlin): 30 days later it is still recent, 31 days later it is not.
    const linkOn = (instant: string) =>
      executeCommand(
        linkProblemReportToDefectCommand,
        { problemReportId, version: 0, defectId, resolvedDefectVersion: version },
        { ...later, clock: fixedClock(instant) },
      );
    expect(await linkOn("2026-11-12T22:00:00Z")).toEqual({ ok: false, error: "defect-resolved-too-long-ago" });

    const open = await anOpenDefect(machineId, "Display flickers");
    expect(
      await executeCommand(
        linkProblemReportToDefectCommand,
        { problemReportId, version: 0, defectId: open, machineStatus: "limited", machineVersion: 0 },
        { ...later, clock },
      ),
    ).toEqual({ ok: false, error: "machine-status-without-reopening" });

    expect(await linkOn("2026-11-11T22:00:00Z")).toMatchObject({ ok: true });
  });

  it("rejects linking a defect offered as resolved that someone reopened meanwhile – nothing is stored", async () => {
    const { machineId, defectId, reopen } = await aResolvedDefect();
    const problemReportId = await reported(machineId, "Left flipper does nothing again");
    const seen = (await defectDetails(db, defectId))?.version;
    await reopen("2026-10-14T10:00:00Z");

    const rejected = await executeCommand(
      linkProblemReportToDefectCommand,
      { problemReportId, version: 0, defectId, resolvedDefectVersion: seen },
      { actor: eva, db, clock: linkedAt, newId: randomUUID },
    );

    expect(rejected).toEqual({ ok: false, error: "defect-not-resolved" });
    expect((await problemReportForTriage(db, clock, problemReportId))?.triageOutcome).toBeUndefined();
    expect((await defectDetails(db, defectId))?.reopenings).toHaveLength(1);
  });
});
