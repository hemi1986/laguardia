import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { reportProblemAndTriageCommand, type ReportProblemAndTriageInput } from "@/modules/repair";
import { fixedClock } from "@/platform/clock";
import { executeCommand } from "@/platform/command";
import { testDatabase } from "@/test-support/database";
import { aRegisteredMachine } from "@/test-support/machines";
import { anExistingTeamMember } from "@/test-support/team-members";
import { loadTriageConfirmation, triageConfirmationText } from "./triage-confirmation";

/**
 * What a page confirms after a triage outcome (G3; ST-018 – ST-023, ST-052; architecture review 2026-10-18): only what
 * the latest command on it did, only for the team member who ran it, and only what is stored – the address alone
 * cannot make a page say anything. One module for the triage list and the machine record.
 */
const db = testDatabase();
const clock = fixedClock("2026-10-12T11:00:00Z");
const tom = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;
const eva = { kind: "team-member", teamMemberId: randomUUID(), role: "technician" } as const;

async function reported(machineId: string, triage: NonNullable<ReportProblemAndTriageInput["triage"]>, actor = tom) {
  await anExistingTeamMember(db, actor, actor === tom ? "Tom" : "Eva");
  const outcome = await executeCommand(
    reportProblemAndTriageCommand,
    { machineId, description: "Left flipper barely moves", triage },
    { actor, db, clock, newId: randomUUID },
  );
  if (!outcome.ok) throw new Error(outcome.error);
  return outcome.result;
}

const aDefect = (title: string, machineStatus?: "out-of-order") =>
  ({
    outcome: "defect-recorded",
    title,
    priority: undefined,
    suitableForHelpers: false,
    machineStatus,
    machineVersion: machineStatus ? 0 : undefined,
  }) as const;

const confirm = (query: Record<string, string | string[] | undefined>, viewer = tom.teamMemberId, onMachine?: string) =>
  loadTriageConfirmation(db, clock, viewer, query, onMachine);

describe("the confirmation after a triage outcome", () => {
  it("names the recorded defect – and the machine's new status only when the same step changed it", async () => {
    const plain = await aRegisteredMachine(db);
    const { defectId } = await reported(plain, aDefect("Left flipper weak"));
    const changed = await aRegisteredMachine(db);
    const withStatus = await reported(changed, aDefect("Right flipper dead", "out-of-order"));

    // The address saying `statusChanged` no longer counts – the journal does.
    const recorded = await confirm({ defectRecorded: defectId, statusChanged: "1" });
    expect(recorded).toMatchObject({ outcome: "defect-recorded", title: "Left flipper weak", newStatus: undefined });
    const recordedWithStatus = await confirm({ defectRecorded: withStatus.defectId! });
    expect(recordedWithStatus).toMatchObject({ outcome: "defect-recorded", newStatus: "out-of-order" });
    expect(triageConfirmationText(recordedWithStatus!)).toContain("Außer Betrieb");
  });

  it("names the defect a problem report was linked to, and that one was resolved on the spot", async () => {
    const machineId = await aRegisteredMachine(db);
    const { defectId } = await reported(machineId, aDefect("Left flipper weak"));
    const linked = await reported(machineId, { outcome: "linked", defectId: defectId! });
    const resolved = await reported(machineId, { outcome: "resolved-on-the-spot", note: "Ball freed" });

    expect(await confirm({ linked: linked.problemReportId })).toMatchObject({
      outcome: "linked",
      title: "Left flipper weak",
    });
    expect(await confirm({ resolvedOnTheSpot: resolved.problemReportId })).toMatchObject({
      outcome: "resolved-on-the-spot",
    });
  });

  it("confirms nothing to another team member than the one who triaged", async () => {
    const machineId = await aRegisteredMachine(db);
    const { defectId } = await reported(machineId, aDefect("Left flipper weak"));
    const resolved = await reported(machineId, { outcome: "resolved-on-the-spot", note: "Ball freed" });

    expect(await confirm({ defectRecorded: defectId! }, eva.teamMemberId)).toBeUndefined();
    expect(await confirm({ resolvedOnTheSpot: resolved.problemReportId }, eva.teamMemberId)).toBeUndefined();
  });

  it("confirms nothing the address only claims", async () => {
    const machineId = await aRegisteredMachine(db);
    const elsewhere = await aRegisteredMachine(db);
    const { defectId } = await reported(elsewhere, aDefect("Tilt bob missing"));
    const linkedElsewhere = await reported(elsewhere, { outcome: "linked", defectId: defectId! });
    const resolvedHere = await reported(machineId, { outcome: "resolved-on-the-spot", note: "Ball freed" });
    const defectHere = await reported(machineId, aDefect("Left flipper weak"));
    const linkedHere = await reported(machineId, { outcome: "linked", defectId: defectHere.defectId! });

    for (const query of [
      {},
      // of another machine, on this machine's record
      { defectRecorded: defectId! },
      { linked: linkedElsewhere.problemReportId },
      // of this machine, with another outcome
      { resolvedOnTheSpot: linkedHere.problemReportId },
      { linked: resolvedHere.problemReportId },
      // unknown, malformed, or given twice
      { linked: randomUUID() },
      { resolvedOnTheSpot: "'; drop table problem_report; --" },
      { defectRecorded: "not-an-id" },
      { resolvedOnTheSpot: [resolvedHere.problemReportId, resolvedHere.problemReportId] },
    ]) {
      expect(await confirm(query, tom.teamMemberId, machineId), JSON.stringify(query)).toBeUndefined();
    }
  });
});
