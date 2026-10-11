import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { reportProblemAndTriageCommand, type ReportProblemAndTriageInput } from "@/modules/repair";
import { fixedClock } from "@/platform/clock";
import { executeCommand } from "@/platform/command";
import { testDatabase } from "@/test-support/database";
import { aRegisteredMachine } from "@/test-support/machines";
import { anExistingTeamMember } from "@/test-support/team-members";
import { loadTriagedWhenReporting } from "./triaged-when-reporting";

/**
 * What the machine record confirms after a problem was reported and triaged in the same step (ST-023, ST-052): read
 * from the ID in the address, and only what is stored for that machine – the address cannot make the page say anything
 * else.
 */
const db = testDatabase();
const clock = fixedClock("2026-10-12T11:00:00Z");
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;

async function reported(machineId: string, triage: NonNullable<ReportProblemAndTriageInput["triage"]>) {
  await anExistingTeamMember(db, tom, "Tom");
  const outcome = await executeCommand(
    reportProblemAndTriageCommand,
    { machineId, description: "Left flipper barely moves", triage },
    { actor: tom, db, clock, newId: randomUUID },
  );
  if (!outcome.ok) throw new Error(outcome.error);
  return outcome.result;
}

const aDefect = (title: string) =>
  ({
    outcome: "defect-recorded",
    title,
    priority: undefined,
    suitableForHelpers: false,
    machineStatus: undefined,
    machineVersion: undefined,
  }) as const;

const machine = (id: string) => ({ id, machineStatus: "limited" as const });

describe("the machine record's confirmation after reporting and triaging in the same step", () => {
  it("names the recorded defect – and the machine's status only when the form changed it", async () => {
    const machineId = await aRegisteredMachine(db);
    const { defectId } = await reported(machineId, aDefect("Left flipper weak"));

    expect(await loadTriagedWhenReporting(db, clock, machine(machineId), { defectRecorded: defectId })).toEqual({
      outcome: "defect-recorded",
      title: "Left flipper weak",
      newStatus: undefined,
    });
    expect(
      await loadTriagedWhenReporting(db, clock, machine(machineId), { defectRecorded: defectId, statusChanged: "1" }),
    ).toEqual({ outcome: "defect-recorded", title: "Left flipper weak", newStatus: "limited" });
  });

  it("names the defect a problem report was linked to, and that one was resolved on the spot", async () => {
    const machineId = await aRegisteredMachine(db);
    const { defectId } = await reported(machineId, aDefect("Left flipper weak"));
    const linked = await reported(machineId, { outcome: "linked", defectId });
    const resolved = await reported(machineId, { outcome: "resolved-on-the-spot", note: "Ball freed" });

    expect(await loadTriagedWhenReporting(db, clock, machine(machineId), { linked: linked.problemReportId })).toEqual({
      outcome: "linked",
      title: "Left flipper weak",
    });
    expect(
      await loadTriagedWhenReporting(db, clock, machine(machineId), { resolvedOnTheSpot: resolved.problemReportId }),
    ).toEqual({ outcome: "resolved-on-the-spot" });
  });

  it("confirms nothing the address only claims", async () => {
    const machineId = await aRegisteredMachine(db);
    const elsewhere = await aRegisteredMachine(db);
    const { defectId } = await reported(elsewhere, aDefect("Tilt bob missing"));
    const linkedElsewhere = await reported(elsewhere, { outcome: "linked", defectId });
    const resolvedHere = await reported(machineId, { outcome: "resolved-on-the-spot", note: "Ball freed" });
    const defectHere = await reported(machineId, aDefect("Left flipper weak"));
    const linkedHere = await reported(machineId, { outcome: "linked", defectId: defectHere.defectId });

    for (const query of [
      {},
      // of another machine
      { defectRecorded: defectId },
      { linked: linkedElsewhere.problemReportId },
      { resolvedOnTheSpot: linkedElsewhere.problemReportId },
      // of this machine, with another outcome
      { resolvedOnTheSpot: linkedHere.problemReportId },
      { linked: resolvedHere.problemReportId },
      // unknown, malformed, or given twice
      { linked: randomUUID() },
      { resolvedOnTheSpot: "'; drop table problem_report; --" },
      { defectRecorded: "not-an-id" },
      { resolvedOnTheSpot: [resolvedHere.problemReportId, resolvedHere.problemReportId] },
    ]) {
      expect(
        await loadTriagedWhenReporting(db, clock, machine(machineId), query),
        JSON.stringify(query),
      ).toBeUndefined();
    }
  });
});
