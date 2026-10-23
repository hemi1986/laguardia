import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { fixedClock } from "@/platform/clock";
import { executeCommand, journalOf } from "@/platform/command";
import { testDatabase } from "@/test-support/database";
import { anOpenDefectIn } from "@/test-support/defects";
import { journalSinceRegistration } from "@/test-support/machines";
import { anExistingTeamMember } from "@/test-support/team-members";
import { machineForTeamForm, machineLabels } from "@/modules/collection";
import {
  claimDefectCommand,
  defectDetails,
  logWorkCommand,
  openDefects,
  prioritizeDefectCommand,
  putDefectOnHoldCommand,
  reopenDefectCommand,
  reportProblemAndTriageCommand,
  reportProblemCommand,
  resolveDefectCommand,
  retireMachineCommand,
  triageList,
} from ".";
import { storedProblemReport } from "./command-probes.test-support";

/**
 * CMD-RetireMachine with Repair's retirement policies (ST-039, ADR 0010): POL-RetirementClosesDefects and
 * POL-RetirementDismissesProblemReports run in the retirement's transaction as the system. Observed through the open
 * defects, the defect's page, the triage list and the journal. Every test has a machine of its own.
 */
const db = testDatabase();
const eva = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const at = (instant: string) => ({ db, clock: fixedClock(instant), newId: randomUUID });
const retiredAt = "2026-03-01T11:00:00Z";

const anOpenDefect = (title: string) =>
  anOpenDefectIn(db, { recordedBy: eva, title, at: fixedClock("2026-02-01T09:00:00Z") });

/** Another defect on the same machine, reported and recorded in one step by Eva. */
async function anotherDefect(machineId: string, title: string) {
  const reported = await executeCommand(
    reportProblemAndTriageCommand,
    {
      machineId,
      description: `${title} – seen`,
      triage: {
        outcome: "defect-recorded",
        title,
        priority: undefined,
        suitableForHelpers: false,
        machineStatus: undefined,
        machineVersion: undefined,
      },
    },
    { actor: eva, ...at("2026-02-02T09:00:00Z") },
  );
  if (!reported.ok || !reported.result.defectId) throw new Error("no defect recorded");
  return reported.result.defectId;
}

async function anUntriagedReport(machineId: string) {
  const outcome = await executeCommand(
    reportProblemCommand,
    { machineId, description: "Ball stuck in the scoop" },
    { actor: { kind: "visitor" }, ...at("2026-02-03T09:00:00Z") },
  );
  if (!outcome.ok) throw new Error(outcome.error);
  return outcome.result.problemReportId;
}

async function museumNumberOf(machineId: string) {
  const label = (await machineLabels(db, [machineId])).get(machineId);
  if (!label) throw new Error("no machine");
  return label.museumNumber;
}

async function versionOf(machineId: string) {
  const machine = await machineForTeamForm(db, await museumNumberOf(machineId));
  if (!machine) throw new Error("no machine");
  return machine.version;
}

async function retire(machineId: string, reason = "Sold to a collector") {
  return executeCommand(
    retireMachineCommand,
    { machineId, version: await versionOf(machineId), reason },
    { actor: tom, ...at(retiredAt) },
  );
}

async function ok<T extends { ok: boolean }>(outcome: Promise<T>) {
  const result = await outcome;
  if (!result.ok) throw new Error(JSON.stringify(result));
  return result;
}

describe("Repair's retirement policies", () => {
  it("ST-039: Open defects are closed on retirement", async () => {
    await anExistingTeamMember(db, tom);
    const { machineId, defectId: displayDead } = await anOpenDefect("Display dead");
    await ok(
      executeCommand(
        claimDefectCommand,
        { defectId: displayDead, version: 0 },
        { actor: tom, ...at("2026-02-05T09:00:00Z") },
      ),
    );
    await ok(
      executeCommand(
        putDefectOnHoldCommand,
        { defectId: displayDead, version: 1, reason: "waiting-for-part" },
        { actor: tom, ...at("2026-02-06T09:00:00Z") },
      ),
    );
    const coinMech = await anotherDefect(machineId, "Coin mech jammed");
    await ok(
      executeCommand(
        resolveDefectCommand,
        { defectId: coinMech, version: 0, closingNote: "Coin path cleaned" },
        { actor: eva, ...at("2026-02-07T09:00:00Z") },
      ),
    );

    await ok(retire(machineId));

    const open = await openDefects(db, { machineId });
    expect(open.map((entry) => entry.id)).not.toContain(displayDead);
    // Closed on retirement does not count as resolved: a state of its own, no resolution.
    const closed = await defectDetails(db, displayDead);
    expect(closed?.state).toBe("closed-on-retirement");
    expect(closed?.resolutions).toEqual([]);
    // Like resolving, closing on retirement ends the claim and the hold (AGG-Defect).
    expect(closed?.claim).toBeUndefined();
    expect(closed?.hold).toBeUndefined();
    const resolved = await defectDetails(db, coinMech);
    expect(resolved?.state).toBe("resolved");
    expect(resolved?.resolutions).toHaveLength(1);
    // The retirement first, then the policy's event – journaled as the system.
    const since = await journalSinceRegistration(db, machineId);
    const fromRetirement = since.slice(since.findIndex((entry) => entry.type === "EVT-MachineRetired"));
    expect(fromRetirement.map((entry) => [entry.type, entry.actor.kind])).toEqual([
      ["EVT-MachineRetired", "team-member"],
      ["EVT-DefectClosedOnRetirement", "system"],
    ]);
    expect(fromRetirement[1]).toMatchObject({ aggregate: { type: "AGG-Defect", id: displayDead }, data: {} });
  });

  it("ST-039: Untriaged problem reports are dismissed", async () => {
    await anExistingTeamMember(db, tom);
    const { machineId } = await anOpenDefect("Display dead");
    const report = await anUntriagedReport(machineId);

    await ok(retire(machineId));

    expect((await storedProblemReport(db, report))?.triage).toEqual({
      outcome: "dismissed",
      triagedBy: tom.teamMemberId,
      triagedAt: new Date(retiredAt),
      dismissal: { reason: "machine-retired" },
    });
    expect((await triageList(db, fixedClock(retiredAt))).map((entry) => entry.id)).not.toContain(report);
    const [dismissed] = (await journalOf(db, { aggregateId: report })).filter(
      (entry) => entry.type === "EVT-ProblemReportDismissed",
    );
    expect(dismissed).toMatchObject({ actor: { kind: "system" }, data: { reason: "machine-retired" } });
  });

  it("ST-039: Defects closed on retirement are final", async () => {
    await anExistingTeamMember(db, tom);
    const { machineId, defectId } = await anOpenDefect("Display dead");
    await ok(retire(machineId));
    const version = 1;
    const act = { actor: tom, ...at("2026-03-02T09:00:00Z") };

    expect(await executeCommand(reopenDefectCommand, { defectId, version, reason: "Came back" }, act)).toEqual({
      ok: false,
      error: "defect-not-resolved",
    });
    expect(await executeCommand(claimDefectCommand, { defectId, version }, act)).toMatchObject({ ok: false });
    expect(await executeCommand(prioritizeDefectCommand, { defectId, version, priority: "high" }, act)).toEqual({
      ok: false,
      error: "defect-not-open",
    });
    expect(
      await executeCommand(logWorkCommand, { defectId, version, whatWasDone: "Checked", partsUsed: "" }, act),
    ).toEqual({ ok: false, error: "defect-not-open" });
    expect((await defectDetails(db, defectId))?.state).toBe("closed-on-retirement");
  });

  it("ST-039: A reason is required", async () => {
    await anExistingTeamMember(db, tom);
    const { machineId, defectId } = await anOpenDefect("Display dead");
    const report = await anUntriagedReport(machineId);

    expect(await retire(machineId, "  ")).toEqual({ ok: false, error: "reason-required" });

    expect((await machineForTeamForm(db, await museumNumberOf(machineId)))?.retired).toBe(false);
    expect((await defectDetails(db, defectId))?.state).toBe("open");
    expect((await storedProblemReport(db, report))?.triage).toBeUndefined();
  });
});
